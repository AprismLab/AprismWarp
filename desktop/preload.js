'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('aprismwarp', {
    getBridgeInfo: () => ipcRenderer.invoke('aprismwarp:getBridgeInfo')
});
