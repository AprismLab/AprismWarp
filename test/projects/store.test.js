'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createProjectFile, openProjectFile, saveProjectFile, safeProjectPath} = require('../../src/projects/store');

const spec = {
    projectId: 'store-mod',
    name: 'Store Mod',
    workType: 'AprismJEMod'
};

function tempRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-store-'));
}

test('createProjectFile writes a valid .awp and returns its metadata', () => {
    const root = tempRoot();
    try {
        const created = createProjectFile(root, spec);
        assert.equal(created.relativePath, 'store-mod.awp');
        assert.ok(fs.existsSync(created.projectPath));
        assert.equal(created.manifest.projectId, 'store-mod');
        assert.equal(created.editor.entrypoint, 'com.aprismwarp.generated.Store_modMod');
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('openProjectFile returns manifest, ir, and entry listing', () => {
    const root = tempRoot();
    try {
        createProjectFile(root, spec);
        const opened = openProjectFile(root, 'store-mod.awp');
        assert.equal(opened.manifest.workType, 'AprismJEMod');
        assert.equal(opened.ir.projectId, 'store-mod');
        assert.ok(opened.entries.includes('awp.json'));
        assert.ok(opened.entries.includes('ir/project.json'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('saveProjectFile updates manifest and ir while preserving other entries', () => {
    const root = tempRoot();
    try {
        createProjectFile(root, spec);
        const opened = openProjectFile(root, 'store-mod.awp');
        const renamed = JSON.parse(JSON.stringify(opened.manifest));
        renamed.name = 'Renamed Mod';
        opened.ir.projectId = opened.ir.projectId;
        const saved = saveProjectFile(root, 'store-mod.awp', {manifest: renamed, ir: opened.ir});
        assert.equal(saved.manifest.name, 'Renamed Mod');
        assert.equal(saved.entryCount, opened.entries.length);
        const reopened = openProjectFile(root, 'store-mod.awp');
        assert.equal(reopened.manifest.name, 'Renamed Mod');
        assert.deepEqual(reopened.entries.sort(), opened.entries.sort());
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('safeProjectPath rejects traversal, absolute escapes, and non-.awp targets', () => {
    const root = tempRoot();
    try {
        assert.throws(() => safeProjectPath(root, '../evil.awp'), /STORE-PATH-002/);
        assert.throws(() => safeProjectPath(root, 'sub/../../evil.awp'), /STORE-PATH-002/);
        assert.throws(() => safeProjectPath(root, 'project.txt'), /STORE-PATH-003/);
        assert.throws(() => safeProjectPath(root, ''), /STORE-PATH-001/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('saveProjectFile requires manifest and ir', () => {
    const root = tempRoot();
    try {
        assert.throws(() => saveProjectFile(root, 'x.awp', {}), /STORE-SAVE-001/);
        assert.throws(() => saveProjectFile(root, 'x.awp', null), /STORE-SAVE-001/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover
