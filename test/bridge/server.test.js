'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {start, request, isLoopbackHost, generateToken, BRIDGE_SCHEMA, ERROR_SCHEMA} = require('../../src/bridge/server');
const {writeAwp} = require('../../src/awp/archive');
const {validateIr} = require('../../src/ir/validate');
const {generateAjeAndLock} = require('../../src/compile/aje');

function makeTempDir(label) {
    return fs.mkdtempSync(path.join(os.tmpdir(), `aprismwarp-${label}-`));
}

function buildModAwp(workspaceDir) {
    const manifest = {
        format: 'aprismwarp-project',
        schemaVersion: 1,
        projectId: 'bridge-mod',
        name: 'Bridge Mod',
        workType: 'AprismJEMod',
        workProfile: {minecraftVersion: '26.2', aprismVersion: 'v26.8-Alpha.7', workType: 'AprismJEMod'},
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        source: {editor: 'aprismwarp-native', project: 'editor/project.json', ir: 'ir/project.json'}
    };
    const ir = {
        irVersion: 1, projectId: 'bridge-mod', workType: 'AprismJEMod',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'], declarations: [], handlers: []
    };
    const editor = {
        entrypoint: 'com.example.BridgeMod',
        displayName: 'Bridge Mod',
        description: 'Bridge',
        version: '0.1.0',
        environment: '*'
    };
    const awpPath = path.join(workspaceDir, 'bridge-mod.awp');
    const files = new Map([
        ['editor/project.json', Buffer.from(JSON.stringify(editor, null, 2))],
        ['build/mod.jar', Buffer.from('placeholder-mod-jar')]
    ]);
    writeAwp(awpPath, {manifest, ir, files});
    return awpPath;
}

async function withBridge(options, body) {
    const handle = await start(options);
    try {
        return await body(handle);
    } finally {
        await handle.close();
    }
}

test('isLoopbackHost accepts loopback variants and rejects public hosts', () => {
    assert.equal(isLoopbackHost('127.0.0.1'), true);
    assert.equal(isLoopbackHost('::1'), true);
    assert.equal(isLoopbackHost('0.0.0.0'), false);
    assert.equal(isLoopbackHost('192.168.1.10'), false);
    assert.equal(isLoopbackHost('example.com'), false);
});

test('generateToken produces a 64-character hex string and is unique per call', () => {
    const a = generateToken();
    const b = generateToken();
    assert.equal(a.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(a));
    assert.notEqual(a, b);
});

test('capabilities endpoint reports the bridge schema and version', async () => {
    await withBridge({validateIr: body => validateIr(body.ir), packageAje: () => null}, async handle => {
        const response = await request(handle, 'GET', '/api/v1/capabilities');
        assert.equal(response.schema, BRIDGE_SCHEMA);
        assert.equal(response.bridgeVersion, '0.1.0');
        assert.equal(response.capabilities.compiler.validate, true);
        assert.equal(response.capabilities.compiler.packageAje, true);
        assert.equal(response.capabilities.compiler.packageAep, false);
    });
});

test('status endpoint returns ok with the bridge schema', async () => {
    await withBridge({validateIr: () => ({valid: true}), packageAje: () => null}, async handle => {
        const response = await request(handle, 'GET', '/api/v1/status');
        assert.equal(response.schema, BRIDGE_SCHEMA);
        assert.equal(response.status, 'ok');
    });
});

test('missing bearer token is rejected with 401', async () => {
    await withBridge({validateIr: () => null, packageAje: () => null}, async handle => {
        const text = await rawRequest({host: handle.host, port: handle.port, method: 'GET', path: '/api/v1/capabilities'});
        assert.equal(text.status, 401);
        const body = JSON.parse(text.body);
        assert.equal(body.code, 'BRIDGE-AUTH-001');
        assert.equal(body.schema, ERROR_SCHEMA);
    });
});

test('invalid bearer token is rejected with 403', async () => {
    await withBridge({validateIr: () => null, packageAje: () => null}, async handle => {
        const text = await rawRequest({
            host: handle.host, port: handle.port, method: 'GET', path: '/api/v1/capabilities',
            token: 'wrong-token'
        });
        assert.equal(text.status, 403);
        const body = JSON.parse(text.body);
        assert.equal(body.code, 'BRIDGE-AUTH-002');
    });
});

test('unknown endpoint is rejected with 404', async () => {
    await withBridge({validateIr: () => null, packageAje: () => null}, async handle => {
        try {
            await request(handle, 'GET', '/api/v1/does-not-exist');
            assert.fail('expected unknown endpoint to throw');
        } catch (error) {
            assert.equal(error.statusCode, 404);
        }
    });
});

test('validate endpoint accepts a valid IR and rejects an invalid one', async () => {
    await withBridge({validateIr: body => validateIr(body.ir), packageAje: () => null}, async handle => {
        const ok = await request(handle, 'POST', '/api/v1/projects/validate', {ir: minimalIr()});
        assert.equal(ok.valid, true);
        const bad = await callValidateRaw(handle, {ir: {irVersion: 1}});
        assert.equal(bad.status, 200);
        const body = JSON.parse(bad.body);
        assert.equal(body.valid, false);
        assert.ok(body.diagnostics.length > 0);
    });
});

test('package endpoint compiles an AWP into an AJE under the artifact root', async () => {
    const dir = makeTempDir('bridge-pkg');
    try {
        const artifactRoot = path.join(dir, 'artifacts');
        const awpPath = buildModAwp(dir);
        const outputPath = 'mod-out.aje';
        const result = await withBridge({
            artifactRoot,
            validateIr: () => ({valid: true}),
            packageAje: ({awpPath: a, outputPath, lock}) => {
                return generateAjeAndLock(a, outputPath, {updateAwp: lock});
            }
        }, async handle => {
            return request(handle, 'POST', '/api/v1/projects/package', {
                awpPath, outputPath, lock: true
            });
        });
        assert.equal(result.manifest.workType, 'AprismJEMod');
        assert.equal(result.lock.id, 'bridge-mod');
        assert.ok(fs.existsSync(path.join(artifactRoot, outputPath)));
        assert.ok(fs.existsSync(path.join(artifactRoot, `${outputPath}.checksums.txt`)));
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

test('package endpoint rejects path traversal attempts', async () => {
    const dir = makeTempDir('bridge-traversal');
    try {
        const artifactRoot = path.join(dir, 'artifacts');
        fs.mkdirSync(artifactRoot, {recursive: true});
        const awpPath = buildModAwp(dir);
        await withBridge({
            artifactRoot,
            validateIr: () => ({valid: true}),
            packageAje: () => ({})
        }, async handle => {
            try {
                await request(handle, 'POST', '/api/v1/projects/package', {
                    awpPath, outputPath: '../escape.aje', lock: true
                });
                assert.fail('expected path traversal to throw');
            } catch (error) {
                assert.equal(error.statusCode, 400);
                assert.ok(/BRIDGE-FS-/.test(error.body));
            }
        });
    } finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
});

function minimalIr() {
    return {
        irVersion: 1,
        projectId: 'minimal-mod',
        workType: 'AprismJEMod',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        capabilities: ['basic'],
        declarations: [],
        handlers: []
    };
}

function rawRequest({host, port, method, path, token}) {
    return new Promise((resolve, reject) => {
        const req = http.request({host, port, method, path}, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({status: res.statusCode, body: Buffer.concat(chunks).toString('utf8')}));
        });
        req.on('error', reject);
        if (token) req.setHeader('Authorization', `Bearer ${token}`);
        req.end();
    });
}

function callValidateRaw(handle, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request({
            host: handle.host, port: handle.port, method: 'POST', path: '/api/v1/projects/validate',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(payload, 'utf8'),
                'Authorization': `Bearer ${handle.token}`
            }
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({status: res.statusCode, body: Buffer.concat(chunks).toString('utf8')}));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}
