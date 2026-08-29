'use strict';

const path = require('node:path');
const {generateAje} = require('../src/compile/aje');

function usage() {
    console.error('Usage: node scripts/generate-aje.js <input.awp> <output.aje>');
    process.exitCode = 2;
}

function main(argv) {
    if (argv.length !== 4) {
        usage();
        return;
    }
    const awpPath = path.resolve(argv[2]);
    const ajePath = path.resolve(argv[3]);
    try {
        const result = generateAje(awpPath, ajePath);
        console.log(`AJE generated: ${ajePath}`);
        for (const entry of result.entries) {
            console.log(`  ${entry}`);
        }
        console.log(`Checksums: ${result.checksumsPath}`);
    } catch (error) {
        console.error(`generate-aje failed: ${error.message}`);
        process.exitCode = 1;
    }
}

main(process.argv);
