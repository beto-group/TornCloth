const { useState, useEffect, useRef } = dc;

const activeFile = dc.resolvePath("TornCloth");
const folderPath = activeFile 
    ? activeFile.substring(0, activeFile.lastIndexOf('/')) 
    : "_RESOURCES/DATACORE/_DONE/TornCloth";

const { findNearestAncestorWithClass, findDirectChildByClass } = await dc.require(folderPath + "/src/utils/domUtils.jsx");
const { STYLES } = await dc.require(folderPath + "/src/styles/styles.jsx");
const { ClothComponent } = await dc.require(folderPath + "/src/components/ClothComponent.jsx");
const { getLoader } = await dc.require(folderPath + "/src/utils/loadScript.js");

const { loadScript } = getLoader(folderPath);

const App = (props) => {
    const { isInception = false } = props;
    const [key, setKey] = useState(0);
    const [isFullTab, setIsFullTab] = useState(!isInception);
    const containerRef = useRef(null);
    const stateRefs = useRef({}).current;

    const handleCodeReload = () => {
        setKey((prev) => prev + 1);
        if (dc.app.workspace.activeLeaf?.rebuildView) {
            dc.app.workspace.activeLeaf.rebuildView();
        }
    };

    const toggleFullTab = () => {
        if (isInception) return;
        setIsFullTab(!isFullTab);
    };

    // Full-tab mode lifecycle
    useEffect(() => {
        if (!isFullTab || isInception) return;

        const container = containerRef.current;
        if (!container) return;

        const targetPaneContent = findNearestAncestorWithClass(container, "workspace-leaf-content");
        if (!targetPaneContent) {
            setIsFullTab(false);
            return;
        }

        const contentWrapper = findDirectChildByClass(targetPaneContent, "view-content") || targetPaneContent;
        const currentParent = container.parentNode;
        if (!currentParent) return;

        // Create placeholder
        stateRefs.originalParent = currentParent;
        const placeholder = activeDocument.createElement("div");
        placeholder.className = "screen-mode-placeholder";
        Object.assign(placeholder.style, { display: "none" });

        if (container.nextSibling) {
            currentParent.insertBefore(placeholder, container.nextSibling);
        } else {
            currentParent.appendChild(placeholder);
        }
        stateRefs.placeholder = placeholder;

        // Position logic
        stateRefs.parentPositionInfo = {
            element: contentWrapper,
            originalInlinePosition: contentWrapper.style.position,
        };

        if (window.getComputedStyle(contentWrapper).position === 'static') {
            Object.assign(contentWrapper.style, { position: "relative" });
        }

        contentWrapper.appendChild(container);

        // Edge-to-edge styling
        window.requestAnimationFrame(() => {
            Object.assign(contentWrapper.style, {
                padding: "0",
                margin: "0",
                height: "100%",
                width: "100%",
                display: "block",
                overflow: "hidden",
                minHeight: "0"
            });
        });

        Object.assign(container.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            zIndex: "9998",
            overflow: "hidden",
            backgroundColor: "var(--background-primary)",
        });

        return () => {
            if (stateRefs.placeholder?.parentNode) {
                stateRefs.placeholder.parentNode.replaceChild(container, stateRefs.placeholder);
            } else if (stateRefs.originalParent) {
                stateRefs.originalParent.appendChild(container);
            }

            if (stateRefs.parentPositionInfo?.element) {
                const { element, originalInlinePosition } = stateRefs.parentPositionInfo;
                Object.assign(element.style, { position: originalInlinePosition || '' });
            }
            container.removeAttribute("style");
        };
    }, [isFullTab, isInception]);

    // Hide status bar when in Full Tab mode
    useEffect(() => {
        if (!isFullTab || isInception) return;

        const statusBar = activeDocument.querySelector('body > .app-container .status-bar');
        let originalDisplay = '';

        if (statusBar) {
            originalDisplay = statusBar.style.display;
            Object.assign(statusBar.style, { display: 'none' });
        }

        return () => {
            if (statusBar) {
                Object.assign(statusBar.style, { display: originalDisplay });
            }
        };
    }, [isFullTab, isInception]);

    // Force compact if inception is active
    const effectiveFullTab = isFullTab && !isInception;

    return (
        <div ref={containerRef} style={{ width: '100%', height: effectiveFullTab ? '100%' : '600px', backgroundColor: 'var(--background-primary)', borderRadius: effectiveFullTab ? '0' : '8px', overflow: 'hidden' }}>
            <ClothComponent
                dc={dc}
                loadScript={loadScript}
                key={key}
                onCodeReloadRequest={handleCodeReload}
                isFullTab={effectiveFullTab}
                isInception={isInception}
                onToggleFullTab={toggleFullTab}
                styles={STYLES}
            />
        </div>
    );
};

return { App };
