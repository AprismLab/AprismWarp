'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const {app, BrowserWindow, ipcMain, Menu, dialog} = require('electron');
const path = require('node:path');
const {startAppCore} = require(path.join(__dirname, 'lib', 'app-core'));
const {request} = require(path.join(__dirname, '..', 'src', 'bridge', 'server'));
const {createProjectFile, openProjectFile} = require(path.join(__dirname, '..', 'src', 'projects', 'store'));

let bridgeHandle = null;
let projectRoot = null;
let currentProject = null;

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

ipcMain.handle('aprismwarp:openEditor', async (event, workType, project) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return {opened: false};
    if (!require('node:fs').existsSync(GUI_EDITOR)) {
        return {opened: false, error: 'GUI build is missing; run the gui build first.'};
    }
    currentProject = project || null;
    const search = workType ? `workType=${encodeURIComponent(workType)}` : '';
    await window.loadFile(GUI_EDITOR, {search});
    if (currentProject) {
        await window.webContents.executeJavaScript(
            `window.APRISMWARP_PROJECT = ${JSON.stringify(currentProject)}; 'ok'`, true);
    }
    return {opened: true};
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

async function menuSaveProject(window) {
    if (!currentProject) {
        dialog.showMessageBox(window, {message: 'No project is open. Create one from the wizard first.'});
        return;
    }
    try {
        const payload = await window.webContents.executeJavaScript(
            'window.AprismWarpBlocks.saveProject(window.APRISMWARP_PROJECT)', true, 60000);
        dialog.showMessageBox(window, {
            message: `Saved ${payload.manifest.projectId} (${payload.entryCount} entries).`
        });
    } catch (error) {
        dialog.showMessageBox(window, {message: `Save failed: ${error.message}`});
    }
}

async function menuOpenProject(window) {
    const result = await dialog.showOpenDialog(window, {
        defaultPath: getProjectRoot(),
        filters: [{name: 'AprismWarp Project', extensions: ['awp']}],
        properties: ['openFile']
    });
    if (result.canceled || !result.filePaths[0]) return;
    const chosen = path.resolve(result.filePaths[0]);
    if (!chosen.startsWith(path.resolve(getProjectRoot()) + path.sep)) {
        dialog.showMessageBox(window, {message: 'Project must live inside the workspace projects folder.'});
        return;
    }
    const relativePath = path.relative(path.resolve(getProjectRoot()), chosen);
    const opened = openProjectFile(getProjectRoot(), relativePath);
    await window.loadFile(GUI_EDITOR, {
        search: `workType=${encodeURIComponent(opened.manifest.workType)}`
    });
    currentProject = {path: relativePath, manifest: opened.manifest};
    await window.webContents.executeJavaScript(
        `window.APRISMWARP_WORK_TYPE = ${JSON.stringify(opened.manifest.workType)}; ` +
        `window.APRISMWARP_PROJECT = ${JSON.stringify(currentProject)}; ` +
        `window.AprismWarpBlocks.loadProject(${JSON.stringify(relativePath)}).then(() => 'loaded')`, true, 60000);
}

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
    if (!process.argv.includes('--smoke')) {
        const menu = Menu.buildFromTemplate([{
            label: 'File',
            submenu: [
                {
                    label: 'Save Project (.awp)',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => menuSaveProject(window)
                },
                {
                    label: 'Open Project (.awp)...',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => menuOpenProject(window)
                },
                {type: 'separator'},
                {role: 'quit'}
            ]
        }]);
        Menu.setApplicationMenu(menu);
    } else {
        window.removeMenu();
    }
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
            currentProject = {path: 'smoke-project.awp', manifest: opened.manifest};
            await window.webContents.executeJavaScript(
                `window.APRISMWARP_PROJECT = ${JSON.stringify(currentProject)}; 'ok'`, true);
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
            let roundTrip = 'skipped';
            if (ir) {
                const saved = await window.webContents.executeJavaScript(
                    'window.AprismWarpBlocks.saveProject(window.APRISMWARP_PROJECT)', true, 60000);
                await window.webContents.executeJavaScript(
                    `window.AprismWarpBlocks.loadProject('smoke-project.awp').then(() => 'loaded')`, true, 60000);
                const reExtracted = JSON.parse(await window.webContents.executeJavaScript(
                    `JSON.stringify(window.AprismWarpBlocks.extractAprismWarpIr(` +
                    `window.Blockly.getMainWorkspace(), window.APRISMWARP_WORK_TYPE || 'AprismJEMod', ` +
                    `'smoke-project', {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'}))`, true, 60000));
                const normalise = doc => JSON.stringify({
                    declarations: [...doc.declarations].sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
                    handlers: [...doc.handlers].sort((a, b) => a.nodeId.localeCompare(b.nodeId))
                });
                roundTrip = normalise(saved.ir) === normalise(reExtracted);
            }
            console.log(`APRISMWARP_SMOKE_OK bridge=${bridgeHandle.bridgeUrl} gui=${url.includes('editor.html')} project=${opened.manifest.projectId} ir=${ir ? 'extracted' : `error: ${irError}`} roundTrip=${roundTrip}`);
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
