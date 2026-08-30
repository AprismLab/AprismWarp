'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const path = require('node:path');
const {verifyAepLockForAwp} = require('../src/extension/lock');

function usage() {
    console.error('Usage: node scripts/verify-aep-lock.js <aep> <awp>');
    console.error('  Exits 0 when the AEP matches the AWP lock.');
    console.error('  Exits 1 when the AEP is missing, malformed, or fails the lock.');
    console.error('  Exits 2 on usage errors.');
    process.exitCode = 2;
}

function main(argv) {
    if (argv.length !== 4) {
        usage();
        return;
    }
    const aepPath = path.resolve(argv[2]);
    const awpPath = path.resolve(argv[3]);
    try {
        const result = verifyAepLockForAwp(aepPath, awpPath);
        console.log(JSON.stringify(result, null, 2));
        if (result.diagnostics.some(d => d.severity === 'error')) {
            process.exitCode = 1;
        } else if (!result.matched && result.checked) {
            process.exitCode = 1;
        } else if (!result.checked) {
            console.error('verify-aep-lock: AWP declares no AEP lock; install one with --lock.');
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(`verify-aep-lock failed: ${error.message}`);
        process.exitCode = 1;
    }
}

main(process.argv);

