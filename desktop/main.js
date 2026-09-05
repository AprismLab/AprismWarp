'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('node:path');
const {startAppCore} = require(path.join(__dirname, 'lib', 'app-core'));

let bridgeHandle = null;

async function ensureBridge() {
    if (!bridgeHandle) {
        bridgeHandle = await startAppCore({
            artifactRoot: path.join(app.getPath('userData'), 'artifacts')
        });
    }
    return bridgeHandle;
}

ipcMain.handle('aprismwarp:getBridgeInfo', async () => {
    const handle = await ensureBridge();
    return {bridgeUrl: handle.bridgeUrl, token: handle.token};
});

const GUI_EDITOR = path.join(__dirname, '..', 'gui', 'scratch-gui', 'build', 'editor.html');

function guiAvailable() {
    return require('node:fs').existsSync(GUI_EDITOR);
}

async function createWindow() {
    await ensureBridge();
    const window = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'AprismWarp',
        show: !process.argv.includes('--smoke'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    window.removeMenu();
    if (guiAvailable()) {
        window.loadFile(GUI_EDITOR);
    } else {
        window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    }
    return window;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

app.whenReady().then(async () => {
    try {
        const window = await createWindow();
        if (process.argv.includes('--smoke')) {
            await ensureBridge();
            await Promise.race([
                new Promise(resolve => window.webContents.once('did-finish-load', resolve)),
                new Promise(resolve => setTimeout(resolve, 30000))
            ]);
            const url = window.webContents.getURL();
            console.log(`APRISMWARP_SMOKE_OK bridge=${bridgeHandle.bridgeUrl} gui=${url.includes('editor.html')}`);
            window.destroy();
            app.exit(0);
            return;
        }
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow().catch(error => {
                    console.error(`AprismWarp failed to recreate window: ${error.message}`);
                    app.exit(1);
                });
            }
        });
    } catch (error) {
        console.error(`AprismWarp failed to start: ${error.message}`);
        app.exit(1);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
    if (bridgeHandle) {
        const handle = bridgeHandle;
        bridgeHandle = null;
        await handle.close();
    }
});
