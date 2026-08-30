'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const path = require('node:path');
const {inspectAep} = require('../src/aep/inspect');
const {verifyAepLockForAwp} = require('../src/extension/lock');

function parseArgs(argv) {
    const positional = [];
    let awp = null;
    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--awp') {
            awp = argv[++i];
        } else if (arg === '--help' || arg === '-h') {
            return null;
        } else {
            positional.push(arg);
        }
    }
    return {positional, awp};
}

function usage() {
    console.error('Usage: node scripts/inspect-aep.js <extension.aep> [--awp <project.awp>]');
    process.exitCode = 2;
}

function main(argv) {
    const args = parseArgs(argv);
    if (!args) {
        usage();
        return;
    }
    if (args.positional.length !== 1) {
        usage();
        return;
    }
    const archivePath = path.resolve(args.positional[0]);
    const result = {inspect: inspectAep(archivePath)};
    if (args.awp) {
        result.lock = verifyAepLockForAwp(archivePath, path.resolve(args.awp));
    }
    console.log(JSON.stringify(result, null, 2));
}

main(process.argv);

