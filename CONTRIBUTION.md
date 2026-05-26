# 🛠️ Contributing to Torn Cloth (main)

Welcome! This document outlines the core developer standards, unit testing frameworks, and compilation guidelines required to maintain the advanced implementation of the Torn Cloth component.

---

## 🏛️ Core Architecture Pillars

1.  **Full-Pane DOM Interception**:
    *   The view targets the nearest `.workspace-leaf-content` ancestor and replaces standard Markdown leaves with a full-pane portal overlay.
    *   Dynamic lifecycle hooks manage mounting and cleanups edge-to-edge.
2.  **Anti-Bleed Style Isolation**:
    *   All styles must be scoped tightly under standard container class keys (`.torn-cloth-container`) to avoid spilling into the Obsidian UI or interfering with active user themes.
3.  **Resilient CDN Cache Caching**:
    *   Third-party libraries (`three.js`, `OrbitControls`, `lil-gui`) must be loaded using the local `loadScript.js` utility, which manages an offline caching vault under `assets/cache/scripts/` to ensure flawless load times.
4.  **Polling Hot Reload Daemon**:
    *   Maintains an active watch interval checking `data/mcp_commands.json` modifications to trigger instant updates during coding sessions.

---

## 🚀 Local Compilation & Test Loop

*   **Hot Reload Trigger**: During development, update the files in your dev folder. The active daemon polls `data/mcp_commands.json` and updates the React instance inside Obsidian instantly without requiring system restarts.
