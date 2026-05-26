const { useState, useEffect } = dc;
const { App } = await dc.require(dc.resolvePath("TORN CLOTH/src/App.jsx"));

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

const RootView = (props) => {
  const [stamp, setStamp] = useState(0);

  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.id = "torn-cloth-immersive";
    styleEl.innerHTML = immersiveCss;
    document.head.appendChild(styleEl);
    
    // Polling watch daemon
    const interval = setInterval(async () => {
      try {
        const cmdFile = dc.resolvePath("TORN CLOTH/data/mcp_commands.json");
        const stat = await app.vault.adapter.stat(cmdFile);
        if (stat && stat.mtime > stamp) {
          setStamp(stat.mtime);
        }
      } catch (e) {
        // Ignore file not found
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      const existing = document.getElementById("torn-cloth-immersive");
      if (existing) existing.remove();
    };
  }, [stamp]);

  return <App key={stamp} {...props} />;
};

async function View(props) {
  return function ViewComponent() {
    return <RootView {...props} />;
  };
}

return { View };
