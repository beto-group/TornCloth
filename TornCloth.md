---
layout: full
---

```datacorejsx
const activeFile = dc.resolvePath("TornCloth");
const folderPath = activeFile 
    ? activeFile.substring(0, activeFile.lastIndexOf('/')) 
    : "_RESOURCES/DATACORE/_DONE/TornCloth";
const { View } = await dc.require(folderPath + "/src/index.jsx");
return await View({ folderPath, dc });
```
