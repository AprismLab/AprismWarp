'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const fs = require('node:fs');
const path = require('node:path');
const {createProject} = require('../wizard/project');
const {writeAwp, readAwp} = require('../awp/archive');

/**
 * Resolves a project-relative path inside the project root and refuses
 * traversal outside it. Mirrors the bridge safePath rules.
 *
 * @param {string} projectRoot absolute root directory
 * @param {string} candidate relative project file path
 * @returns {string} absolute path inside the project root
 */
function safeProjectPath(projectRoot, candidate) {
    if (typeof candidate !== 'string' || !candidate.trim()) {
        throw storeError('STORE-PATH-001', 'project path is required.');
    }
    const root = path.resolve(projectRoot);
    const resolved = path.resolve(root, candidate);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw storeError('STORE-PATH-002', `project path escapes the project root: ${candidate}`);
    }
    if (!resolved.toLowerCase().endsWith('.awp')) {
        throw storeError('STORE-PATH-003', 'project path must reference a .awp file.');
    }
    return resolved;
}

function storeError(code, message) {
    const error = new Error(`${code}: ${message}`);
    error.code = code;
    return error;
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Creates a new .awp project file from a wizard spec. The wizard output
 * is validated before it touches the disk.
 *
 * @param {string} projectRoot absolute root directory for project files
 * @param {object} spec wizard spec ({projectId, name, workType, ...})
 * @returns {{relativePath: string, projectPath: string, manifest: object, ir: object, editor: object|null}}
 */
function createProjectFile(projectRoot, spec) {
    const project = createProject(spec);
    const relativePath = `${spec.projectId}.awp`;
    const projectPath = safeProjectPath(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(projectPath), {recursive: true});
    writeAwp(projectPath, {manifest: project.manifest, ir: project.ir});
    return {
        relativePath,
        projectPath,
        manifest: project.manifest,
        ir: project.ir,
        editor: project.editor
    };
}

/**
 * Opens an existing .awp project read-only. Resource bytes stay on
 * disk; only the manifest, IR, and the archive entry listing travel
 * over the wire.
 *
 * @param {string} projectRoot absolute root directory for project files
 * @param {string} relativePath project file path relative to the root
 * @returns {{relativePath: string, projectPath: string, manifest: object, ir: object, entries: string[]}}
 */
function openProjectFile(projectRoot, relativePath) {
    const projectPath = safeProjectPath(projectRoot, relativePath);
    const project = readAwp(projectPath);
    return {
        relativePath,
        projectPath,
        manifest: project.manifest,
        ir: project.ir,
        entries: [...project.files.keys()]
    };
}

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

/**
 * Saves manifest and IR updates into an existing .awp project. All
 * other archive entries (resources, editor metadata, mixins) are
 * preserved from the current on-disk state.
 *
 * @param {string} projectRoot absolute root directory for project files
 * @param {string} relativePath project file path relative to the root
 * @param {{manifest: object, ir: object}} update replacement manifest and IR
 * @returns {{relativePath: string, projectPath: string, manifest: object, ir: object, entryCount: number}}
 */
function saveProjectFile(projectRoot, relativePath, update) {
    if (!update || typeof update !== 'object') {
        throw storeError('STORE-SAVE-001', 'save requires a manifest and ir.');
    }
    if (!update.manifest || !update.ir) {
        throw storeError('STORE-SAVE-001', 'save requires a manifest and ir.');
    }
    const projectPath = safeProjectPath(projectRoot, relativePath);
    const existing = readAwp(projectPath);
    const files = existing.files;
    files.set('awp.json', Buffer.from(JSON.stringify(update.manifest, null, 2) + '\n'));
    files.set('ir/project.json', Buffer.from(JSON.stringify(update.ir, null, 2) + '\n'));
    writeAwp(projectPath, {manifest: update.manifest, ir: update.ir, files});
    return {
        relativePath,
        projectPath,
        manifest: update.manifest,
        ir: update.ir,
        entryCount: files.size
    };
}

module.exports = {createProjectFile, openProjectFile, saveProjectFile, safeProjectPath};
