'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const path = require('node:path');
const {start} = require(path.join(__dirname, '..', '..', 'src', 'bridge', 'server'));
const {validateIr} = require(path.join(__dirname, '..', '..', 'src', 'ir', 'validate'));
const {readAwp} = require(path.join(__dirname, '..', '..', 'src', 'awp', 'archive'));const {generateAjeAndLock} = require(path.join(__dirname, '..', '..', 'src', 'compile', 'aje'));
const {createProjectFile, openProjectFile, saveProjectFile} = require(path.join(__dirname, '..', '..', 'src', 'projects', 'store'));
const {generateAjeAndBuild} = require(path.join(__dirname, '..', '..', 'src', 'compile', 'aje'));

function handleValidateIr(body) {
    if (!body || !body.ir) {
        const error = new Error('validate requires an `ir` field');
        error.code = 'BRIDGE-VAL-001';
        error.statusCode = 400;
        throw error;
    }
    const result = validateIr(body.ir, {mode: body.mode || 'export'});
    return {valid: result.valid, diagnostics: result.diagnostics};
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

function handlePackageAje(args) {
    const awpPath = path.resolve(args.awpPath);
    const outputPath = path.resolve(args.outputPath);
    const irProject = readAwp(awpPath);
    if (irProject.manifest.workType !== 'AprismJEMod') {
        const error = new Error(`workType must be AprismJEMod; got "${irProject.manifest.workType}"`);
        error.code = 'BRIDGE-PKG-002';
        error.statusCode = 400;
        throw error;
    }
    const result = generateAjeAndBuild(awpPath, outputPath, {awpOutPath: undefined, updateAwp: args.lock !== false, build: args.build === true});
    return {manifest: result.manifest, lock: result.lock, outputPath, checksumsPath: result.checksumsPath, built: result.built};
}

/**
 * Starts the AprismWarp application core: the loopback host bridge with the
 * same handler wiring as the CLI launcher. Returns a handle the Electron
 * main process (or any embedder) uses to reach the bridge and shut down.
 *
 * @param {{port?: number, artifactRoot?: string}} [options]
 * @returns {Promise<{host: string, port: number, token: string, bridgeUrl: string, close: Function}>}
 */
async function startAppCore(options = {}) {
    const projectRoot = options.projectRoot
        ? path.resolve(options.projectRoot)
        : path.join(__dirname, '..', '..', 'projects');
    const handle = await start({
        host: options.host,
        port: options.port,
        artifactRoot: options.artifactRoot
            ? path.resolve(options.artifactRoot)
            : path.join(__dirname, '..', '..', 'artifacts'),
        projectRoot,
        validateIr: handleValidateIr,
        packageAje: handlePackageAje,
        createProject: (spec) => createProjectFile(projectRoot, spec),
        openProject: (projectPath) => openProjectFile(projectRoot, projectPath),
        saveProject: (body) => saveProjectFile(projectRoot, body.path, body)
    });
    return Object.assign(handle, {
        bridgeUrl: `http://${handle.host}:${handle.port}`,
        projectRoot
    });
}

module.exports = {startAppCore, handleValidateIr, handlePackageAje};
