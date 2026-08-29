'use strict';

const path = require('node:path');
const {generateAep} = require('../src/compile/aep');

function usage() {
    console.error('Usage: node scripts/generate-aep.js <input.awp> <output.aep>');
    process.exitCode = 2;
}

function main(argv) {
    if (argv.length !== 4) {
        usage();
        return;
    }
    const awpPath = path.resolve(argv[2]);
    const aepPath = path.resolve(argv[3]);
    try {
        const result = generateAep(awpPath, aepPath);
        console.log(`AEP generated: ${aepPath}`);
        for (const entry of result.entries) {
            console.log(`  ${entry}`);
        }
    } catch (error) {
        console.error(`generate-aep failed: ${error.message}`);
        process.exitCode = 1;
    }
}

main(process.argv);
