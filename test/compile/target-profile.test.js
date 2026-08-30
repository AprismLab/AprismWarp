'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {validateIr, listVerifiedProfiles} = require('../../src/ir/validate');
const {findVerifiedProfile, normaliseAprismVersion, VERIFIED_PROFILES} = require('../../src/compile/target-profile');

const validTarget = {edition: 'JE', minecraft: '26.2', aprism: 'v26.8-Alpha.7'};

function minimalIr(overrides = {}) {
    return Object.assign({
        irVersion: 1,
        projectId: 'profile-test',
        workType: 'AprismJEMod',
        target: validTarget,
        capabilities: ['basic'],
        declarations: [],
        handlers: []
    }, overrides);
}

test('listVerifiedProfiles exposes at least one entry', () => {
    const profiles = listVerifiedProfiles();
    assert.ok(profiles.length > 0, 'at least one verified profile required');
    assert.deepEqual(profiles[0], {minecraft: '26.2', aprism: 'v26.8-Alpha.7', aprismRange: '>=26.8.0 <26.9.0'});
});

test('normaliseAprismVersion strips v prefix and stability suffix', () => {
    assert.equal(normaliseAprismVersion('v26.8-Alpha.7'), '26.8.7');
    assert.equal(normaliseAprismVersion('26.8.7'), '26.8.7');
    assert.equal(normaliseAprismVersion('v26.8.0+build.1'), '26.8.0');
    assert.equal(normaliseAprismVersion('not-a-version'), null);
});

test('findVerifiedProfile matches the stored combination and SemVer release', () => {
    const profile = findVerifiedProfile(validTarget);
    assert.equal(profile.minecraft, '26.2');
    assert.equal(profile.aprism, 'v26.8-Alpha.7');
    const alt = findVerifiedProfile({edition: 'JE', minecraft: '26.2', aprism: '26.8.7'});
    assert.ok(alt, 'SemVer release form must match the verified profile');
    assert.equal(alt.minecraft, '26.2');
});

test('findVerifiedProfile returns null for unknown combinations', () => {
    assert.equal(findVerifiedProfile({minecraft: '26.1', aprism: 'v26.8-Alpha.7'}), null);
    assert.equal(findVerifiedProfile({minecraft: '26.2', aprism: 'v27.0.0'}), null);
    assert.equal(findVerifiedProfile(null), null);
    assert.equal(findVerifiedProfile({}), null);
});


//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('validateIr accepts the verified target', () => {
    const result = validateIr(minimalIr());
    const profileDiagnostics = result.diagnostics.filter(d => d.code === 'AWP-IR-009');
    assert.equal(profileDiagnostics.length, 0, 'verified profile must not produce AWP-IR-009: ' + JSON.stringify(profileDiagnostics));
});

test('validateIr rejects an unverified Minecraft version with AWP-IR-009', () => {
    const result = validateIr(minimalIr({target: {edition: 'JE', minecraft: '26.0', aprism: 'v26.8-Alpha.7'}}));
    const diag = result.diagnostics.find(d => d.code === 'AWP-IR-009');
    assert.ok(diag, 'expected AWP-IR-009 for unknown Minecraft version');
    assert.match(diag.message, /26\.0/);
    assert.match(diag.message, /Known profiles/);
});

test('validateIr rejects an unverified Aprism version with AWP-IR-009', () => {
    const result = validateIr(minimalIr({target: {edition: 'JE', minecraft: '26.2', aprism: 'v27.0.0'}}));
    const diag = result.diagnostics.find(d => d.code === 'AWP-IR-009');
    assert.ok(diag, 'expected AWP-IR-009 for unknown Aprism version');
    assert.match(diag.message, /27\.0\.0/);
});

test('VERIFIED_PROFILES is frozen and exported', () => {
    assert.equal(Object.isFrozen(VERIFIED_PROFILES), true);
    assert.equal(Object.isFrozen(VERIFIED_PROFILES[0]), true);
    assert.throws(() => { VERIFIED_PROFILES[0].minecraft = '26.99'; });
});
