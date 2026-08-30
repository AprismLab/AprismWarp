'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const assert = require('node:assert/strict');
const test = require('node:test');
const {buildExtensionManifest, validateExtensionManifest} = require('../../src/extension/manifest');

function input(extension = {}, overrides = {}) {
    return Object.assign({
        projectId: 'example-extension',
        target: {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'},
        ir: {
            extension: Object.assign({
                type: 'api-extension',
                aprismRange: '>=26.8.0'
            }, extension)
        },
        entrypoint: 'com.example.MyExtension',
        displayName: 'Example Extension',
        description: 'A demonstration extension.'
    }, overrides);
}

test('builds a manifest from a clean API-extension IR', () => {
    const manifest = buildExtensionManifest(input({
        provides: ['example:capability'],
        depends: {other: '>=1.0.0'},
        priority: 7
    }));

    assert.equal(manifest.extensionId, 'example-extension');
    assert.equal(manifest.type, 'api-extension');
    assert.equal(manifest.aprismRange, '>=26.8.0');
    assert.equal(manifest.entrypoint, 'com.example.MyExtension');
    assert.equal(manifest.displayName, 'Example Extension');
    assert.equal(manifest.mcEdit, 'JE');
    assert.equal(manifest.mcVersion, '26.2');
    assert.equal(manifest.priority, 7);
    assert.deepEqual(manifest.provides, ['example:capability']);
    assert.deepEqual(manifest.depends, {other: '>=1.0.0'});
    assert.equal(manifest.loaderKey, undefined);
    assert.equal(manifest.loaderRange, undefined);
});
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('builds a loader-support manifest with the correct key and range', () => {
    const manifest = buildExtensionManifest(input({
        type: 'loader-support',
        aprismRange: '>=26.8.0',
        loaderKey: 'Fa',
        loaderRange: '>=0.19.0',
        provides: ['aprismwarp:fabric-blocks']


    }));

    assert.equal(manifest.type, 'loader-support');
    assert.equal(manifest.loaderKey, 'Fa');
    assert.equal(manifest.loaderRange, '>=0.19.0');
    assert.deepEqual(manifest.provides, ['aprismwarp:fabric-blocks']);
});

test('drops empty provides and depends when none are declared', () => {
    const manifest = buildExtensionManifest(input({type: 'platform-adapter'}));

    assert.equal(manifest.type, 'platform-adapter');
    assert.equal(manifest.provides, undefined);
    assert.equal(manifest.depends, undefined);
});

test('rejects unknown extension type', () => {
    assert.throws(() => buildExtensionManifest(input({type: 'magic-extension'})), /EXT-005/);
});

test('rejects loader-support with missing loaderRange', () => {
    assert.throws(() => buildExtensionManifest(input({type: 'loader-support', loaderKey: 'Fa'})), /EXT-012/);
});

test('rejects non-loader-support type with loaderKey', () => {
    assert.throws(() => buildExtensionManifest(input({type: 'api-extension', loaderKey: 'Fa', loaderRange: '>=0.19.0'})), /EXT-013/);
});

test('rejects non-loader-support type with loaderRange', () => {
    assert.throws(() => buildExtensionManifest(input({type: 'converter', loaderRange: '>=0.19.0'})), /EXT-014/);
});

test('rejects invalid entrypoint, id, and SemVer', () => {
    assert.throws(() => buildExtensionManifest(Object.assign(input(), {entrypoint: 'NotAClass'})), /EXT-007/);
    assert.throws(() => buildExtensionManifest(Object.assign(input(), {projectId: 'BAD-id'})), /EXT-003/);
    assert.throws(() => buildExtensionManifest(Object.assign(input(), {version: '0.1'})), /EXT-010/);
});

test('rejects duplicate provides', () => {
    assert.throws(() => buildExtensionManifest(input({provides: ['dup', 'dup']})), /EXT-022/);
});

test('rejects invalid depends extension id', () => {
    assert.throws(() => buildExtensionManifest(input({depends: {'Bad_Id': '>=1.0.0'}})), /EXT-031/);
});
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('rejects missing required fields', () => {
    let displayNameErr = null;
    let descriptionErr = null;
    try {


        buildExtensionManifest(input({}, {displayName: ''}));
    } catch (error) {
        displayNameErr = error;
    }
    assert.ok(displayNameErr, 'empty displayName should throw');
    assert.match(displayNameErr.message, /EXT-008/);

    try {
        buildExtensionManifest(input({}, {description: ''}));
    } catch (error) {
        descriptionErr = error;
    }
    assert.ok(descriptionErr, 'empty description should throw');
    assert.match(descriptionErr.message, /EXT-009/);
});

test('validateExtensionManifest re-validates an existing hand-written manifest', () => {
    const manifest = buildExtensionManifest(input({
        type: 'loader-support',
        loaderKey: 'Fa',
        loaderRange: '>=0.19.0'
    }));
    const result = validateExtensionManifest(manifest);
    assert.equal(result.valid, true);
    assert.deepEqual(result.diagnostics, []);
});

test('validateExtensionManifest rejects a manifest with missing loaderKey for loader-support', () => {
    const result = validateExtensionManifest({
        extensionId: 'test-ext',
        version: '1.0.0',
        type: 'loader-support',
        aprismRange: '>=26.8.0',
        loaderRange: '>=0.19.0',
        mcEdit: 'JE',
        mcVersion: '26.2',
        entrypoint: 'com.test.Test',
        displayName: 'Test',
        description: 'test',
        priority: 0
    });
    assert.equal(result.valid, false);
    assert.ok(result.diagnostics.some(d => d.code === 'EXT-V010'));
});

