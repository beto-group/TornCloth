async function View({ folderPath, dc }) {
  const { useEffect, useRef, useState } = dc;

  function RootView() {
    const containerRef = useRef(null);
    const [hijacked, setHijacked] = useState(false);
    const componentId = 'torn-cloth-wasm';
    const styleId = `fulltab-${componentId}`;

    // Layer 1 - Scoped CSS Chrome Suppression
    useEffect(() => {
      let styleEl = activeDocument.getElementById(styleId);
      if (!styleEl) {
        styleEl = activeDocument.createElement('style');
        styleEl.id = styleId;
        styleEl.innerHTML = `
          /* 1. Hide the global status bar ONLY when the active tab contains our component */
          body:has(.workspace-leaf.mod-active #torn-cloth-wasm-container) .status-bar {
              display: none !important;
          }
          
          /* 2. Scope full-height and scroll-blocking overrides specifically to the containing scroller */
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .cm-scroller,
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .markdown-preview-view {
              height: 100% !important;
              overflow: hidden !important;
              position: relative !important;
          }
          
          /* 3. Scope layout and header/footer overrides specifically to the containing leaf */
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .inline-title,
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .view-footer,
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .workspace-leaf-content-footer,
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .mod-footer,
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .embedded-backlinks {
              display: none !important;
          }
          
          .workspace-leaf-content:has(#torn-cloth-wasm-container) {
              padding: 0 !important;
              margin: 0 !important;
              border-radius: 0 !important;
          }
          
          /* 4. Suppress the actual markdown preview content so it doesn't overlap or cause scroll */
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .markdown-preview-sizer,
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .cm-content,
          .workspace-leaf-content:has(#torn-cloth-wasm-container) .cm-gutters {
              display: none !important;
          }
        `;
        activeDocument.head.appendChild(styleEl);
      }
      return () => {
        const el = activeDocument.getElementById(styleId);
        if (el) el.remove();
      };
    }, []);

    // Layer 2 - DOM Reparenting to .cm-scroller / .markdown-preview-view
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let attempts = 0;
      const originalParent = container.parentNode;
      let placeholder = null;

      const hijack = () => {
        try {
          const leaf = container.closest('.workspace-leaf');
          const scroller = leaf?.querySelector('.cm-scroller') || leaf?.querySelector('.markdown-preview-view');
          if (scroller) {
            if (!placeholder) {
              placeholder = activeDocument.createElement('div');
              placeholder.style.display = 'none';
              if (container.nextSibling) {
                originalParent.insertBefore(placeholder, container.nextSibling);
              } else {
                originalParent.appendChild(placeholder);
              }
            }

            scroller.appendChild(container);
            Object.assign(container.style, {
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '100%',
              zIndex: '10',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              visibility: 'visible',
              backgroundColor: '#111111',
            });
            setHijacked(true);
            return true;
          }
        } catch (e) {
          console.error("Hijack error:", e);
        }
        return false;
      };

      if (hijack()) return;

      const poller = setInterval(() => {
        if (hijack() || attempts++ > 100) clearInterval(poller);
      }, 16);

      return () => {
        clearInterval(poller);
        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.replaceChild(container, placeholder);
        } else if (originalParent) {
          originalParent.appendChild(container);
        }
        container.removeAttribute("style");
      };
    }, []);

    // Dynamic ESM Load
    useEffect(() => {
      if (!hijacked) return;
      let active = true;
      let cleanup = null;

      async function load() {
        try {
          const file = dc.app.vault.getAbstractFileByPath(`${folderPath}/dist/torn-cloth.es.js`);
          if (!file) throw new Error("Could not find dist/torn-cloth.es.js in vault");
          const url = dc.app.vault.getResourcePath(file);

          const module = await import(url);
          if (!active) return;

          const instanceCleanup = await module.mount_app(containerRef.current, dc);
          if (!active) {
            if (instanceCleanup) instanceCleanup();
            return;
          }
          cleanup = instanceCleanup;
        } catch (err) {
          console.error("Failed to load TornCloth ESM bundle:", err);
        }
      }

      load();

      return () => {
        active = false;
        if (cleanup) cleanup();
      };
    }, [hijacked]);

    return (
      <div 
        ref={containerRef} 
        id="torn-cloth-wasm-container" 
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
          visibility: hijacked ? 'visible' : 'hidden',
        }}
      />
    );
  }

  return <RootView />;
}

return { View };
