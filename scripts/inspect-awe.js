'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

const path = require('node:path');
const {inspectAwe, configureAweSchemaPath} = require('../src/awe/inspect');

const repoRoot = path.resolve(__dirname, '..');
configureAweSchemaPath(path.join(repoRoot, 'schemas', 'awe.schema.json'));

const archivePath = process.argv[2];
if (!archivePath) {
    console.error('Usage: node scripts/inspect-awe.js <extension.awe>');
    process.exitCode = 1;
} else {
    const result = inspectAwe(path.resolve(archivePath));
    console.log(JSON.stringify({
        valid: result.valid,
        id: result.manifest ? result.manifest.id : null,
        version: result.manifest ? result.manifest.version : null,
        permissions: result.manifest ? result.manifest.permissions : [],
        runtimeEntry: result.runtimeEntry,
        blocksDeclared: Boolean(result.blocks),
        panels: result.panels.map(panel => panel.file),
        diagnostics: result.diagnostics
    }, null, 2));
    if (!result.valid) process.exitCode = 1;
}
