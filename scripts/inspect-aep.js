'use strict';

const {inspectAep} = require('../src/aep/inspect');

const archivePath = process.argv[2];
if (!archivePath) {
    console.error('Usage: node scripts/inspect-aep.js <extension.aep>');
    process.exitCode = 2;
} else {
    // This command only reads the declarative editor manifest. It never loads
    // or executes extension.jar, native libraries, or editor runtime code.
    console.log(JSON.stringify(inspectAep(archivePath), null, 2));
}
