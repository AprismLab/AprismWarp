'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('node:path');
const {startAppCore} = require(path.join(__dirname, 'lib', 'app-core'));
const {request} = require(path.join(__dirname, '..', 'src', 'bridge', 'server'));
const {createProjectFile, openProjectFile} = require(path.join(__dirname, '..', 'src', 'projects', 'store'));

let bridgeHandle = null;
let projectRoot = null;

const GUI_EDITOR = path.join(__dirname, '..', 'gui', 'scratch-gui', 'build', 'editor.html');
const WIZARD_PAGE = path.join(__dirname, 'renderer', 'wizard.html');

function getProjectRoot() {
    if (!projectRoot) {
        projectRoot = path.join(app.getPath('userData'), 'projects');
    }
    return projectRoot;
}

async function ensureBridge() {
    if (!bridgeHandle) {
        bridgeHandle = await startAppCore({
            artifactRoot: path.join(app.getPath('userData'), 'artifacts'),
            projectRoot: getProjectRoot()
        });
    }
    return bridgeHandle;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

ipcMain.handle('aprismwarp:getBridgeInfo', async () => {
    const handle = await ensureBridge();
    return {bridgeUrl: handle.bridgeUrl};
});

ipcMain.handle('aprismwarp:bridgeRequest', async (event, method, requestPath, body) => {
    const handle = await ensureBridge();
    return request(handle, method, requestPath, body);
});

ipcMain.handle('aprismwarp:openEditor', async (event, workType) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return {opened: false};
    if (!require('node:fs').existsSync(GUI_EDITOR)) {
        return {opened: false, error: 'GUI build is missing; run the gui build first.'};
    }
    const search = workType ? `workType=${encodeURIComponent(workType)}` : '';
    await window.loadFile(GUI_EDITOR, {search});
    return {opened: true};
});

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
    window.loadFile(WIZARD_PAGE);
    return window;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

app.whenReady().then(async () => {
    try {
        const window = await createWindow();
        if (process.argv.includes('--smoke')) {
            await ensureBridge();
            const created = createProjectFile(getProjectRoot(), {
                projectId: 'smoke-project',
                name: 'Smoke Project',
                workType: 'AprismJEMod'
            });
            const opened = openProjectFile(getProjectRoot(), 'smoke-project.awp');
            await window.loadFile(GUI_EDITOR, {search: 'workType=AprismJEMod'});
            await Promise.race([
                new Promise(resolve => window.webContents.once('did-finish-load', resolve)),
                new Promise(resolve => setTimeout(resolve, 30000))
            ]);
            const url = window.webContents.getURL();
            let ir = null;
            let irError = null;
            try {
                const injected = await window.webContents.executeJavaScript(
                    `window.AprismWarpBlocks.assembleSampleProject()`, true, 30000);
                ir = JSON.parse(injected);
            } catch (error) {
                irError = error.message;
            }
            if (ir) {
                const {validateIr} = require(path.join(__dirname, '..', 'src', 'ir', 'validate'));
                const verdict = validateIr(ir, {mode: 'export'});
                console.log(`APRISMWARP_G3_CHECK irValid=${verdict.valid} ` +
                    `diagnostics=${verdict.diagnostics.map(d => d.code).join(',') || 'none'}`);
            }
            console.log(`APRISMWARP_SMOKE_OK bridge=${bridgeHandle.bridgeUrl} gui=${url.includes('editor.html')} project=${opened.manifest.projectId} ir=${ir ? 'extracted' : `error: ${irError}`}`);
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
