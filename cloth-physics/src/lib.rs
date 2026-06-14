use wasm_bindgen::prelude::*;

#[derive(Clone, Copy)]
struct Particle {
    pos: [f32; 3],
    prev_pos: [f32; 3],
    pinned: bool,
    active: bool,
}

struct Constraint {
    p1: usize,
    p2: usize,
    length: f32,
    active: bool,
}

#[wasm_bindgen]
pub struct ClothSimulation {
    particles: Vec<Particle>,
    constraints: Vec<Constraint>,
    cols: usize,
    rows: usize,
    vertex_buffer: Vec<f32>,
    normal_buffer: Vec<f32>,
    index_buffer: Vec<u32>,
    active_buffer: Vec<f32>,
}

#[wasm_bindgen]
impl ClothSimulation {
    #[wasm_bindgen(constructor)]
    pub fn new(cols: usize, rows: usize, width: f32, height: f32) -> ClothSimulation {
        let mut particles = Vec::with_capacity(cols * rows);
        let mut constraints = Vec::new();

        let dx = width / (cols - 1) as f32;
        let dy = height / (rows - 1) as f32;

        for r in 0..rows {
            for c in 0..cols {
                let x = (c as f32) * dx - (width * 0.5);
                let y = (height * 0.5) - (r as f32) * dy;
                let z = 0.0;
                let pinned = r == 0;

                particles.push(Particle {
                    pos: [x, y, z],
                    prev_pos: [x, y, z],
                    pinned,
                    active: true,
                });
            }
        }

        // Structural and Shear Constraints
        for r in 0..rows {
            for c in 0..cols {
                let i = r * cols + c;
                if c < cols - 1 {
                    constraints.push(Constraint {
                        p1: i,
                        p2: i + 1,
                        length: dx,
                        active: true,
                    });
                }
                if r < rows - 1 {
                    constraints.push(Constraint {
                        p1: i,
                        p2: i + cols,
                        length: dy,
                        active: true,
                    });
                }
                if c < cols - 1 && r < rows - 1 {
                    constraints.push(Constraint {
                        p1: i,
                        p2: i + cols + 1,
                        length: (dx * dx + dy * dy).sqrt(),
                        active: true,
                    });
                }
                if c > 0 && r < rows - 1 {
                    constraints.push(Constraint {
                        p1: i,
                        p2: i + cols - 1,
                        length: (dx * dx + dy * dy).sqrt(),
                        active: true,
                    });
                }
            }
        }

        let mut index_buffer = Vec::new();
        for r in 0..rows - 1 {
            for c in 0..cols - 1 {
                let i0 = r * cols + c;
                let i1 = i0 + 1;
                let i2 = (r + 1) * cols + c;
                let i3 = i2 + 1;

                index_buffer.push(i0 as u32);
                index_buffer.push(i1 as u32);
                index_buffer.push(i2 as u32);

                index_buffer.push(i1 as u32);
                index_buffer.push(i3 as u32);
                index_buffer.push(i2 as u32);
            }
        }

        let vertex_buffer = vec![0.0; cols * rows * 3];
        let normal_buffer = vec![0.0; cols * rows * 3];
        let active_buffer = vec![1.0; cols * rows];

        ClothSimulation {
            particles,
            constraints,
            cols,
            rows,
            vertex_buffer,
            normal_buffer,
            index_buffer,
            active_buffer,
        }
    }

    pub fn tick(&mut self, dt: f32, gravity: f32, wind_force: f32, wind_time: f32) {
        let drag = 0.98; // Slightly more drag for stability at lower resolutions
        let dt_sq = dt * dt;

        // Apply external forces (Gravity + Wind)
        for i in 0..self.particles.len() {
            let p = &mut self.particles[i];
            if p.pinned || !p.active {
                continue;
            }

            let temp_x = p.pos[0];
            let temp_y = p.pos[1];
            let temp_z = p.pos[2];

            let vel_x = (p.pos[0] - p.prev_pos[0]) * drag;
            let vel_y = (p.pos[1] - p.prev_pos[1]) * drag;
            let vel_z = (p.pos[2] - p.prev_pos[2]) * drag;

            let wind_ripple = (wind_time * 2.5 + p.pos[0] * 4.0 + p.pos[1] * 2.0).sin();
            let final_wind = wind_force * (1.0 + wind_ripple * 0.4);

            let acc_x = 0.0;
            let acc_y = -gravity;
            let acc_z = final_wind;

            p.pos[0] += vel_x + acc_x * dt_sq;
            p.pos[1] += vel_y + acc_y * dt_sq;
            p.pos[2] += vel_z + acc_z * dt_sq;

            p.prev_pos[0] = temp_x;
            p.prev_pos[1] = temp_y;
            p.prev_pos[2] = temp_z;
        }

        // Solve constraints (Verlet stiffness iterations)
        let iterations = 4; // Reduced from 5 to 4 for performance
        for _ in 0..iterations {
            for c in &mut self.constraints {
                if !c.active {
                    continue;
                }

                if !self.particles[c.p1].active || !self.particles[c.p2].active {
                    c.active = false;
                    continue;
                }

                let p1_pos = self.particles[c.p1].pos;
                let p2_pos = self.particles[c.p2].pos;

                let dx = p2_pos[0] - p1_pos[0];
                let dy = p2_pos[1] - p1_pos[1];
                let dz = p2_pos[2] - p1_pos[2];

                let dist = (dx * dx + dy * dy + dz * dz).sqrt();
                if dist < 0.0001 {
                    continue;
                }

                if dist > c.length * 3.5 {
                    c.active = false;
                    continue;
                }

                let diff = (c.length - dist) / dist * 0.5;
                let offset_x = dx * diff;
                let offset_y = dy * diff;
                let offset_z = dz * diff;

                if !self.particles[c.p1].pinned {
                    self.particles[c.p1].pos[0] -= offset_x;
                    self.particles[c.p1].pos[1] -= offset_y;
                    self.particles[c.p1].pos[2] -= offset_z;
                }
                if !self.particles[c.p2].pinned {
                    self.particles[c.p2].pos[0] += offset_x;
                    self.particles[c.p2].pos[1] += offset_y;
                    self.particles[c.p2].pos[2] += offset_z;
                }
            }
        }

        // --- COMPUTE VERTEX NORMALS IN RUST ---
        // Clear old normals
        for val in &mut self.normal_buffer {
            *val = 0.0;
        }

        // Calculate face normals and accumulate
        for face_idx in (0..self.index_buffer.len()).step_by(3) {
            let i0 = self.index_buffer[face_idx] as usize;
            let i1 = self.index_buffer[face_idx + 1] as usize;
            let i2 = self.index_buffer[face_idx + 2] as usize;

            if !self.particles[i0].active || !self.particles[i1].active || !self.particles[i2].active {
                continue;
            }

            let p0 = self.particles[i0].pos;
            let p1 = self.particles[i1].pos;
            let p2 = self.particles[i2].pos;

            // Edge vectors
            let u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            let v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];

            // Cross product (u x v)
            let nx = u[1] * v[2] - u[2] * v[1];
            let ny = u[2] * v[0] - u[0] * v[2];
            let nz = u[0] * v[1] - u[1] * v[0];

            // Accumulate normals on vertices
            self.normal_buffer[i0 * 3] += nx;
            self.normal_buffer[i0 * 3 + 1] += ny;
            self.normal_buffer[i0 * 3 + 2] += nz;

            self.normal_buffer[i1 * 3] += nx;
            self.normal_buffer[i1 * 3 + 1] += ny;
            self.normal_buffer[i1 * 3 + 2] += nz;

            self.normal_buffer[i2 * 3] += nx;
            self.normal_buffer[i2 * 3 + 1] += ny;
            self.normal_buffer[i2 * 3 + 2] += nz;
        }

        // Normalize the accumulated normal vectors
        for i in 0..self.particles.len() {
            let offset = i * 3;
            let nx = self.normal_buffer[offset];
            let ny = self.normal_buffer[offset + 1];
            let nz = self.normal_buffer[offset + 2];

            let len = (nx * nx + ny * ny + nz * nz).sqrt();
            if len > 0.0001 {
                self.normal_buffer[offset] = nx / len;
                self.normal_buffer[offset + 1] = ny / len;
                self.normal_buffer[offset + 2] = nz / len;
            } else {
                self.normal_buffer[offset] = 0.0;
                self.normal_buffer[offset + 1] = 0.0;
                self.normal_buffer[offset + 2] = 1.0; // Default normal pointing forward
            }
        }

        // Update vertex and active buffers to share with Javascript
        for i in 0..self.particles.len() {
            let p = &self.particles[i];
            let offset = i * 3;
            self.vertex_buffer[offset] = p.pos[0];
            self.vertex_buffer[offset + 1] = p.pos[1];
            self.vertex_buffer[offset + 2] = p.pos[2];
            self.active_buffer[i] = if p.active { 1.0 } else { 0.0 };
        }
    }

    pub fn tear(&mut self, mx: f32, my: f32, mz: f32, radius: f32) {
        let radius_sq = radius * radius;
        for i in 0..self.particles.len() {
            let p = &mut self.particles[i];
            if !p.active {
                continue;
            }

            let dx = p.pos[0] - mx;
            let dy = p.pos[1] - my;
            let dz = p.pos[2] - mz;
            let dist_sq = dx * dx + dy * dy + dz * dz;

            if dist_sq < radius_sq {
                p.active = false;
                p.pinned = false;
            }
        }
    }

    pub fn get_vertices(&self) -> *const f32 {
        self.vertex_buffer.as_ptr()
    }

    pub fn get_normals(&self) -> *const f32 {
        self.normal_buffer.as_ptr()
    }

    pub fn get_indices(&self) -> *const u32 {
        self.index_buffer.as_ptr()
    }

    pub fn get_indices_len(&self) -> usize {
        self.index_buffer.len()
    }

    pub fn get_active_states(&self) -> *const f32 {
        self.active_buffer.as_ptr()
    }

    pub fn displace(&mut self, mx: f32, my: f32, mz: f32, radius: f32, force: f32) {
        let radius_sq = radius * radius;
        for i in 0..self.particles.len() {
            let p = &mut self.particles[i];
            if !p.active || p.pinned {
                continue;
            }

            let dx = p.pos[0] - mx;
            let dy = p.pos[1] - my;
            let dz = p.pos[2] - mz;
            let dist_sq = dx * dx + dy * dy + dz * dz;

            if dist_sq < radius_sq {
                let dist = dist_sq.sqrt();
                let pct = 1.0 - (dist / radius);
                let pull = pct * force;

                p.pos[0] += (mx - p.pos[0]) * pull;
                p.pos[1] += (my - p.pos[1]) * pull;
                p.pos[2] += (mz - p.pos[2]) * pull;
            }
        }
    }
}
