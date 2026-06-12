/* eslint-disable obsidianmd/rule-custom-message */
/**
 * Self-contained local Script & ESM Loader for Component
 * Caches loaded resources in the component's assets/cache/ folder.
 */
function getLoader(folderPath) {
  // Strip trailing file if folderPath actually points to the entry markdown file
  let basePath = folderPath;
  if (basePath.endsWith('.md')) {
    basePath = basePath.substring(0, basePath.lastIndexOf('/'));
  }
  const cacheDir = basePath + "/assets/cache/scripts";
  const imageCacheDir = basePath + "/assets/cache/images";

  async function ensureDirectoryExists(adapter, path) {
    const parts = path.split('/');
    let currentPath = '';
    for (const part of parts) {
      if (!part) continue;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!(await adapter.exists(currentPath))) {
        try {
          await adapter.mkdir(currentPath);
        } catch {
          // ignore
        }
      }
    }
  }

  async function loadScript(dc, src, options = {}) {
    const {
      type = 'script',
      globalName = null,
      cache = true,
      onload = null,
      onerror = null
    } = options;

    if (!dc || !dc.app || !dc.app.vault || !dc.app.vault.adapter) {
      const error = new Error("Datacore context 'dc' with vault adapter is required for loadScript.");
      if (onerror) onerror(error);
      throw error;
    }

    const adapter = dc.app.vault.adapter;
    const isUrl = /^https?:\/\//.test(src);

    // --- GLOBAL DEDUPLICATION CHECK ---
    if (globalName && window[globalName]) {
      console.log(`[LoadScript] ✓ ${globalName} already available (skipping load)`);
      return type === 'module' ? window[globalName] : Promise.resolve();
    }

    // --- GLOBAL PROMISE TRACKING ---
    window.__scriptPromises = window.__scriptPromises || {};
    const promiseKey = `${type}:${src}`;
    
    if (window.__scriptPromises[promiseKey]) {
      console.log(`[LoadScript] ⏳ ${src} already loading, reusing promise...`);
      return window.__scriptPromises[promiseKey];
    }

    console.log(`[LoadScript] 📥 Loading ${type} from ${isUrl ? 'URL' : 'local'}: ${src}`);

    const loadPromise = (async () => {
      try {
        let scriptContent = null;

        // Fetch or read script content
        if (isUrl) {
          const safeFilename = src
            .replace(/^https?:\/\//, '')
            .replace(/[/\\?%*:|"<>]/g, '_') + '.js';
          const cachePath = `${cacheDir}/${safeFilename}`;

          // Check cache first
          if (cache && await adapter.exists(cachePath)) {
            console.log(`[LoadScript] 📦 Loading from cache: ${cachePath}`);
            try {
              scriptContent = await adapter.read(cachePath);
            } catch (readError) {
              console.warn(`[LoadScript] ⚠️ Cache read failed, refetching:`, readError);
            }
          }

          // Fetch from network if not cached
          if (scriptContent === null) {
            console.log(`[LoadScript] 🌐 Fetching from network: ${src}`);
            const response = await window.requestUrl({ url: src });
            
            if (response.status !== 200) {
              throw new Error(`HTTP ${response.status}`);
            }
            
            scriptContent = response.text;

            // Write to cache
            if (cache) {
              try {
                await ensureDirectoryExists(adapter, cacheDir);
                console.log(`[LoadScript] 💾 Caching to: ${cachePath}`);
                await adapter.write(cachePath, scriptContent);
              } catch (writeError) {
                console.warn(`[LoadScript] ⚠️ Cache write failed:`, writeError);
              }
            }
          }
        } else {
          // Local vault path
          console.log(`[LoadScript] 📁 Reading from vault: ${src}`);
          if (!(await adapter.exists(src))) {
            throw new Error(`Local file not found: ${src}`);
          }
          scriptContent = await adapter.read(src);
        }

        // Execute based on type
        let result;

        if (type === 'module') {
          console.log(`[LoadScript] 🎭 Loading as ESM module...`);
          try {
            let moduleExports;
            
            if (isUrl) {
              console.log(`[LoadScript] 📦 Importing from URL: ${src}`);
              // eslint-disable-next-line no-unsanitized/method
              moduleExports = await import(src);
            } else {
              console.log(`[LoadScript] 📦 Importing from blob...`);
              const blob = new Blob([scriptContent], { type: 'application/javascript' });
              const blobUrl = URL.createObjectURL(blob);
              
              try {
                // eslint-disable-next-line no-unsanitized/method
                moduleExports = await import(blobUrl);
              } finally {
                URL.revokeObjectURL(blobUrl);
              }
            }
            
            console.log(`[LoadScript] ✅ Module loaded successfully`);
            
            if (globalName) {
              window[globalName] = moduleExports;
              console.log(`[LoadScript] 🌍 Stored as window.${globalName}`);
            }
            
            result = moduleExports;
            
          } catch (importError) {
            throw new Error(`Module import failed: ${importError.message}`);
          }
          
        } else {
          console.log(`[LoadScript] 📜 Loading as classic script...`);
          
          const scriptElement = activeDocument.createElement('script');
          try {
            scriptElement.textContent = scriptContent;
            activeDocument.body.appendChild(scriptElement);
            console.log(`[LoadScript] ✅ Script executed successfully`);
            
            if (globalName) {
              if (window[globalName]) {
                console.log(`[LoadScript] 🌍 window.${globalName} available`);
              } else {
                console.warn(`[LoadScript] ⚠️ Global "${globalName}" not found after load`);
              }
            }
            
            result = scriptElement;
            
          } catch (execError) {
            console.error(`[LoadScript] ❌ Script execution failed:`, execError);
            if (scriptElement.parentNode) {
              scriptElement.parentNode.removeChild(scriptElement);
            }
            throw new Error(`Script execution failed: ${execError.message}`);
          }
        }

        if (onload) {
          onload(result);
        }

        console.log(`[LoadScript] 🎉 Load complete: ${src}`);
        return result;

      } catch (error) {
        console.error(`[LoadScript] 💥 Failed to load ${src}:`, error);
        if (onerror) {
          onerror(error);
        }
        throw error;
      } finally {
        delete window.__scriptPromises[promiseKey];
      }
    })();

    window.__scriptPromises[promiseKey] = loadPromise;
    return loadPromise;
  }

  async function loadMultiple(dc, scripts, parallel = false) {
    if (parallel) {
      return Promise.all(scripts.map(({ src, options }) => loadScript(dc, src, options)));
    } else {
      const results = [];
      for (const { src, options } of scripts) {
        results.push(await loadScript(dc, src, options));
      }
      return results;
    }
  }

  async function fetchAndCacheImage(dc, url) {
    const adapter = dc.app.vault.adapter;
    const safeFilename = url.replace(/^https?:\/\//, '').replace(/[/\\?%*:|"<>]/g, '_');
    const cachePath = `${imageCacheDir}/${safeFilename}`;

    if (await adapter.exists(cachePath)) {
      try {
        const binaryData = await adapter.readBinary(cachePath);
        const blob = new Blob([binaryData]);
        return URL.createObjectURL(blob);
      } catch (readError) {
        console.warn(`[ImageCache] Cache read failed, re-fetching:`, readError);
      }
    }

    const response = await window.requestUrl({ url: url });
    if (response.status !== 200) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const buffer = response.arrayBuffer;

    try {
      await ensureDirectoryExists(adapter, imageCacheDir);
      await adapter.writeBinary(cachePath, buffer);
    } catch (writeError) {
      console.warn(`[ImageCache] Cache write failed:`, writeError);
    }

    const blob = new Blob([buffer]);
    return URL.createObjectURL(blob);
  }

  return { loadScript, loadMultiple, fetchAndCacheImage };
}

return { getLoader };
