'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const fs = require('node:fs');
const path = require('node:path');
const {validateIr} = require('../src/ir/validate');

const examplePath = path.join(__dirname, '..', 'examples', 'minimal.ir.json');
const result = validateIr(JSON.parse(fs.readFileSync(examplePath, 'utf8')));

if (!result.valid) {
    console.error(JSON.stringify(result.diagnostics, null, 2));
    process.exitCode = 1;
} else {
    console.log('Minimal IR validates for export.');
}

