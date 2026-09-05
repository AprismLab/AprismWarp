'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('aprismwarp', {
    getBridgeInfo: () => ipcRenderer.invoke('aprismwarp:getBridgeInfo'),
    bridgeRequest: (method, path, body) => ipcRenderer.invoke('aprismwarp:bridgeRequest', method, path, body),
    openEditor: () => ipcRenderer.invoke('aprismwarp:openEditor')
});
