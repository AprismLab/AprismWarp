'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const path = require('node:path');
const {verifyAjeLockForAwp} = require('../src/extension/lock');

function usage() {
    console.error('Usage: node scripts/verify-aje-lock.js <aje> <awp>');
    console.error('  Exits 0 when the AJE matches the AWP lock.');
    console.error('  Exits 1 when the AJE is missing, malformed, or fails the lock.');
    console.error('  Exits 2 on usage errors.');
    process.exitCode = 2;
}

function main(argv) {
    if (argv.length !== 4) {
        usage();
        return;
    }
    const ajePath = path.resolve(argv[2]);
    const awpPath = path.resolve(argv[3]);
    try {
        const result = verifyAjeLockForAwp(ajePath, awpPath);
        console.log(JSON.stringify(result, null, 2));
        if (result.diagnostics.some(d => d.severity === 'error')) {
            process.exitCode = 1;
        } else if (!result.matched && result.checked) {
            process.exitCode = 1;
        } else if (!result.checked) {
            console.error('verify-aje-lock: AWP declares no AJE lock; install one with --lock.');
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(`verify-aje-lock failed: ${error.message}`);
        process.exitCode = 1;
    }
}

main(process.argv);

