'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {start, request} = require('../../src/bridge/server');
const {createProjectFile, openProjectFile, saveProjectFile} = require('../../src/projects/store');

function tempRoot(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `aprismwarp-bridge-store-${label}-`));
}

function storeOptions(projectRoot) {
    return {
        createProject: (spec) => createProjectFile(projectRoot, spec),
        openProject: (projectPath) => openProjectFile(projectRoot, projectPath),
        saveProject: (body) => saveProjectFile(projectRoot, body.path, body)
    };
}

const spec = {projectId: 'bridge-store', name: 'Bridge Store', workType: 'AprismJEMod'};

test('create endpoint writes a project and returns its manifest', async () => {
    const root = tempRoot('create');
    const handle = await start(storeOptions(root));
    try {
        const payload = await request(handle, 'POST', '/api/v1/projects/create', {spec});
        assert.equal(payload.manifest.projectId, 'bridge-store');
        assert.equal(payload.relativePath, 'bridge-store.awp');
        assert.ok(fs.existsSync(payload.projectPath));
    } finally {
        await handle.close();
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('open endpoint returns manifest, ir, and entries', async () => {
    const root = tempRoot('open');
    const handle = await start(storeOptions(root));
    try {
        await request(handle, 'POST', '/api/v1/projects/create', {spec});
        const payload = await request(handle, 'POST', '/api/v1/projects/open', {path: 'bridge-store.awp'});
        assert.equal(payload.manifest.workType, 'AprismJEMod');
        assert.equal(payload.ir.projectId, 'bridge-store');
        assert.ok(payload.entries.includes('ir/project.json'));
    } finally {
        await handle.close();
        fs.rmSync(root, {recursive: true, force: true});
    }
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('save endpoint persists manifest changes and preserves entries', async () => {
    const root = tempRoot('save');
    const handle = await start(storeOptions(root));
    try {
        await request(handle, 'POST', '/api/v1/projects/create', {spec});
        const opened = await request(handle, 'POST', '/api/v1/projects/open', {path: 'bridge-store.awp'});
        const renamed = Object.assign({}, opened.manifest, {name: 'Saved Name'});
        const payload = await request(handle, 'POST', '/api/v1/projects/save',
            {path: 'bridge-store.awp', manifest: renamed, ir: opened.ir});
        assert.equal(payload.manifest.name, 'Saved Name');
        const reopened = await request(handle, 'POST', '/api/v1/projects/open', {path: 'bridge-store.awp'});
        assert.equal(reopened.manifest.name, 'Saved Name');
    } finally {
        await handle.close();
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('store endpoints reject traversal attempts', async () => {
    const root = tempRoot('traversal');
    const handle = await start(storeOptions(root));
    try {
        await assert.rejects(
            () => request(handle, 'POST', '/api/v1/projects/open', {path: '../evil.awp'}),
            /STORE-PATH-002/
        );
        await assert.rejects(
            () => request(handle, 'POST', '/api/v1/projects/save',
                {path: '../evil.awp', manifest: {}, ir: {}}),
            /STORE-PATH-002/
        );
    } finally {
        await handle.close();
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('store endpoints return 501 when the store is not configured', async () => {
    const handle = await start({});
    try {
        for (const [route, body] of [
            ['/api/v1/projects/create', {spec}],
            ['/api/v1/projects/open', {path: 'x.awp'}],
            ['/api/v1/projects/save', {path: 'x.awp', manifest: {}, ir: {}}]
        ]) {
            const error = await request(handle, 'POST', route, body).then(
                () => null, e => e
            );
            assert.ok(error, `${route} should fail without a store`);
            assert.match(error.message, /BRIDGE-STORE-001/);
        }
    } finally {
        await handle.close();
    }
});

test('store endpoints validate their request bodies', async () => {
    const root = tempRoot('validation');
    const handle = await start(storeOptions(root));
    try {
        await assert.rejects(
            () => request(handle, 'POST', '/api/v1/projects/create', {}),
            /BRIDGE-STORE-002/
        );
        await assert.rejects(
            () => request(handle, 'POST', '/api/v1/projects/open', {}),
            /BRIDGE-STORE-003/
        );
        await assert.rejects(
            () => request(handle, 'POST', '/api/v1/projects/save', {path: 'x.awp'}),
            /BRIDGE-STORE-004/
        );
    } finally {
        await handle.close();
        fs.rmSync(root, {recursive: true, force: true});
    }
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover
