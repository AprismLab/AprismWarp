'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const assert = require('node:assert/strict');
const test = require('node:test');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const {startAppCore} = require('../lib/app-core');
const {request, BRIDGE_SCHEMA} = require('../../src/bridge/server');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aprismwarp-desktop-'));

test('startAppCore boots the bridge on loopback with a token and serves status', async () => {
    const handle = await startAppCore({port: 0, artifactRoot: tempRoot});
    try {
        assert.equal(handle.host, '127.0.0.1');
        assert.ok(handle.port > 0);
        assert.match(handle.token, /^[a-f0-9]{64}$/);
        assert.equal(handle.bridgeUrl, `http://127.0.0.1:${handle.port}`);
        const status = await request(handle, 'GET', '/api/v1/status');
        assert.equal(status.status, 'ok');
        assert.equal(status.schema, BRIDGE_SCHEMA);
    } finally {
        await handle.close();
    }
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('startAppCore validate endpoint accepts a valid minimal IR', async () => {
    const handle = await startAppCore({port: 0, artifactRoot: tempRoot});
    try {
        const ir = {
            irVersion: 1,
            projectId: 'desktop-core-test',
            workType: 'AprismJEMod',
            target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
            capabilities: ['basic'],
            declarations: [],
            handlers: []
        };
        const result = await request(handle, 'POST', '/api/v1/projects/validate', {ir});
        assert.equal(result.valid, true);
    } finally {
        await handle.close();
    }
});

test('handleValidateIr rejects a missing ir field with BRIDGE-VAL-001', () => {
    assert.throws(() => require('../lib/app-core').handleValidateIr({}), /validate requires/);
});

test('startAppCore capabilities report the bridge schema', async () => {
    const handle = await startAppCore({port: 0, artifactRoot: tempRoot});
    try {
        const capabilities = await request(handle, 'GET', '/api/v1/capabilities');
        assert.equal(capabilities.schema, BRIDGE_SCHEMA);
    } finally {
        await handle.close();
    }
});

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover
