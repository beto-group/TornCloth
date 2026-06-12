
async function View({ folderPath, dc }) {
  const { useState, useEffect } = dc;
  const { App } = await dc.require(folderPath + "/src/App.jsx");

  // FullTab Stylesheet Injector for immersive full pane mode
  const immersiveCss = `
    .workspace-leaf-content[data-type="markdown"] .view-header {
      display: none !important;
    }
    .workspace-leaf-content[data-type="markdown"] .view-content {
      padding: 0 !important;
      overflow: hidden !important;
    }
    .status-bar {
      display: none !important;
    }
    .markdown-source-view.mod-cm6 .cm-scroller {
      padding: 0 !important;
    }
  `;

  function RootView(props) {
    const [stamp, setStamp] = useState(0);

    useEffect(() => {
      const styleEl = activeDocument.createElement("style");
      styleEl.id = "torn-cloth-immersive";
      styleEl.textContent = immersiveCss;
      activeDocument.head.appendChild(styleEl);
      
      // Polling watch daemon
      const interval = window.setInterval(async () => {
        try {
          const cmdFile = folderPath + "/data/mcp_commands.json";
          if (dc.app) {
            const stat = await dc.app.vault.adapter.stat(cmdFile);
            if (stat && stat.mtime > stamp) {
              setStamp(stat.mtime);
            }
          }
        } catch {
          // Ignore file not found
        }
      }, 2000);

      return () => {
        window.clearInterval(interval);
        const existing = activeDocument.getElementById("torn-cloth-immersive");
        if (existing) existing.remove();
      };
    }, [stamp]);

    return <App folderPath={folderPath} key={stamp} {...props} />;
  }

  return <RootView />;
}

return { View };
