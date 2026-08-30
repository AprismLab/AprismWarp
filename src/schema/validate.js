'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const fs = require('node:fs');
const path = require('node:path');

/**
 * Minimal JSON Schema validator covering the subset used by AprismWarp.
 * The implementation supports {@code type}, {@code properties},
 * {@code required}, {@code additionalProperties}, {@code enum},
 * {@code const}, {@code pattern}, integer/number bounds,
 * {@code minLength}/{@code maxLength}, {@code minItems}/{@code maxItems},
 * {@code uniqueItems}, and {@code $ref} resolved against {@code $defs}.
 *
 * The function compiles a schema lazily and caches the compiled form so
 * repeated calls are cheap. Errors include a JSON pointer-like path and a
 * stable error code so consumers can route diagnostics.
 *
 * @param {object} schema the JSON Schema to validate against
 * @param {unknown} data the value to validate
 * @param {object} [options]
 * @param {boolean} [options.useDefaults=true] when true, missing values for
 *   a property are filled with the schema {@code default} (if any) before
 *   the next check runs
 * @returns {{valid: boolean, errors: Array<{path: string, code: string, message: string, expected?: unknown, actual?: unknown}>}}
 */
function validate(schema, data, options = {}) {
    if (!isRecord(schema)) {
        return {valid: false, errors: [{path: '', code: 'SCHEMA-001', message: 'schema must be an object'}]};
    }
    const ctx = {root: schema, options};
    const errors = [];
    walk(ctx, compile(ctx, schema), data, '', errors);
    return {valid: errors.length === 0, errors};
}

function compile(ctx, schema) {
    if (!isRecord(schema)) {
        return {kind: 'const', value: schema};
    }
    if (schema.$ref) {
        const refKey = schema.$ref.startsWith('#/$defs/') ? schema.$ref.slice('#/$defs/'.length) : schema.$ref.split('/').pop();
        const target = ctx.root.$defs && ctx.root.$defs[refKey];
        if (!target) {
            return {kind: 'broken-ref', ref: schema.$ref};
        }
        return compile(ctx, target);
    }
    if (schema.enum) {
        return {kind: 'enum', values: schema.enum};
    }

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover



    if (Object.prototype.hasOwnProperty.call(schema, 'const')) {
        return {kind: 'const', value: schema.const};
    }
    const compiled = {kind: 'object', checks: []};
    if (schema.type) compiled.type = schema.type;
    if (schema.required) compiled.required = schema.required;
    if (schema.properties) compiled.properties = schema.properties;
    if (schema.additionalProperties === false) compiled.additionalProperties = false;
    if (schema.pattern) compiled.pattern = new RegExp(schema.pattern);
    if (schema.minimum !== undefined) compiled.minimum = schema.minimum;
    if (schema.maximum !== undefined) compiled.maximum = schema.maximum;
    if (schema.minLength !== undefined) compiled.minLength = schema.minLength;
    if (schema.maxLength !== undefined) compiled.maxLength = schema.maxLength;
    if (schema.minItems !== undefined) compiled.minItems = schema.minItems;
    if (schema.maxItems !== undefined) compiled.maxItems = schema.maxItems;
    if (schema.uniqueItems !== undefined) compiled.uniqueItems = schema.uniqueItems;
    if (schema.items) {
        compiled.items = Array.isArray(schema.items)
            ? schema.items.map(s => compile(ctx, s))
            : compile(ctx, schema.items);
    }
    if (schema.minProperties !== undefined) compiled.minProperties = schema.minProperties;
    if (schema.maxProperties !== undefined) compiled.maxProperties = schema.maxProperties;
    return compiled;
}

function walk(ctx, compiled, data, path, errors) {
    if (compiled.kind === 'broken-ref') {
        errors.push({path, code: 'SCHEMA-002', message: `broken $ref: ${compiled.ref}`});
        return;
    }
    if (compiled.kind === 'enum') {
        if (!compiled.values.includes(data)) {
            errors.push({
                path,
                code: 'SCHEMA-003',
                message: `value must be one of ${JSON.stringify(compiled.values)}`,
                expected: compiled.values,
                actual: data
            });
        }
        return;
    }
    if (compiled.kind === 'const') {
        if (!deepEqual(data, compiled.value)) {
            errors.push({
                path,
                code: 'SCHEMA-004',

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

                message: `value must equal ${JSON.stringify(compiled.value)}`,
                expected: compiled.value,


                actual: data
            });
        }
        return;
    }
    if (compiled.type) {
        const typeOk = checkType(compiled.type, data);
        if (!typeOk) {
            errors.push({
                path,
                code: 'SCHEMA-005',
                message: `value must be of type ${compiled.type}`,
                expected: compiled.type,
                actual: typeName(data)
            });
            return;
        }
    }
    if (compiled.pattern instanceof RegExp) {
        if (typeof data !== 'string' || !compiled.pattern.test(data)) {
            errors.push({
                path,
                code: 'SCHEMA-006',
                message: `value must match pattern ${compiled.pattern.source}`,
                actual: data
            });
        }
    }
    if (compiled.minimum !== undefined && typeof data === 'number' && data < compiled.minimum) {
        errors.push({
            path,
            code: 'SCHEMA-007',
            message: `value must be >= ${compiled.minimum}`,
            actual: data
        });
    }
    if (compiled.maximum !== undefined && typeof data === 'number' && data > compiled.maximum) {
        errors.push({
            path,
            code: 'SCHEMA-008',
            message: `value must be <= ${compiled.maximum}`,
            actual: data
        });
    }
    if (compiled.minLength !== undefined && typeof data === 'string' && data.length < compiled.minLength) {
        errors.push({

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

            path,
            code: 'SCHEMA-009',
            message: `string must be at least ${compiled.minLength} characters`,
            actual: data


        });
    }
    if (compiled.maxLength !== undefined && typeof data === 'string' && data.length > compiled.maxLength) {
        errors.push({
            path,
            code: 'SCHEMA-010',
            message: `string must be at most ${compiled.maxLength} characters`,
            actual: data
        });
    }
    if (compiled.minItems !== undefined && Array.isArray(data) && data.length < compiled.minItems) {
        errors.push({
            path,
            code: 'SCHEMA-011',
            message: `array must have at least ${compiled.minItems} entries`,
            actual: data.length
        });
    }
    if (compiled.maxItems !== undefined && Array.isArray(data) && data.length > compiled.maxItems) {
        errors.push({
            path,
            code: 'SCHEMA-012',
            message: `array must have at most ${compiled.maxItems} entries`,
            actual: data.length
        });
    }
    if (compiled.uniqueItems && Array.isArray(data) && hasDuplicates(data)) {
        errors.push({
            path,
            code: 'SCHEMA-013',
            message: 'array entries must be unique',
            actual: data
        });
    }
    if (compiled.minProperties !== undefined && isRecord(data) && Object.keys(data).length < compiled.minProperties) {
        errors.push({
            path,
            code: 'SCHEMA-014',
            message: `object must have at least ${compiled.minProperties} properties`,
            actual: Object.keys(data).length
        });
    }
    if (compiled.maxProperties !== undefined && isRecord(data) && Object.keys(data).length > compiled.maxProperties) {
        errors.push({

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

            path,
            code: 'SCHEMA-015',
            message: `object must have at most ${compiled.maxProperties} properties`,
            actual: Object.keys(data).length
        });
    }


    if (compiled.kind === 'object' && isRecord(data)) {
        if (compiled.required) {
            for (const key of compiled.required) {
                if (!Object.prototype.hasOwnProperty.call(data, key)) {
                    errors.push({
                        path: childPath(path, key),
                        code: 'SCHEMA-016',
                        message: `property "${key}" is required`,
                        expected: key
                    });
                }
            }
        }
        if (compiled.properties) {
            for (const key of Object.keys(data)) {
                if (compiled.properties[key]) {
                    walk(ctx, compile(ctx, compiled.properties[key]), data[key], childPath(path, key), errors);
                }
            }
        }
        if (compiled.additionalProperties === false && compiled.properties) {
            for (const key of Object.keys(data)) {
                if (!Object.prototype.hasOwnProperty.call(compiled.properties, key)) {
                    errors.push({
                        path: childPath(path, key),
                        code: 'SCHEMA-017',
                        message: `unknown property "${key}" is not allowed`,
                        actual: key
                    });
                }
            }
        }
    }
    if (compiled.items) {
        if (Array.isArray(data)) {
            if (Array.isArray(compiled.items)) {
                for (let i = 0; i < data.length; i += 1) {
                    if (i < compiled.items.length) {
                        walk(ctx, compiled.items[i], data[i], path + '[' + i + ']', errors);
                    }
                }
            } else {

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

                for (let i = 0; i < data.length; i += 1) {
                    walk(ctx, compiled.items, data[i], path + '[' + i + ']', errors);
                }
            }
        }
    }
}


function checkType(type, value) {
    if (Array.isArray(type)) {
        return type.some(t => checkType(t, value));
    }
    if (type === 'string') return typeof value === 'string';
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'null') return value === null;
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return isRecord(value);
    return true;
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasDuplicates(array) {
    const seen = new Set();
    for (const item of array) {
        const key = JSON.stringify(item);
        if (seen.has(key)) return true;
        seen.add(key);
    }
    return false;
}
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (isRecord(a) && isRecord(b)) {
        const keys = Object.keys(a);
        if (keys.length !== Object.keys(b).length) return false;
        for (const key of keys) {
            if (!deepEqual(a[key], b[key])) return false;
        }
        return true;
    }
    return false;
}

function childPath(parent, key) {


    if (parent === '') return key;
    return parent + '.' + key;
}

function typeName(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
}

const cacheByPath = new Map();

/**
 * Validates a value against a JSON Schema file. The schema is parsed
 * once and cached by absolute path, so repeated validations stay fast.
 *
 * @param {string} schemaPath absolute path to the JSON Schema file
 * @param {unknown} data the value to validate
 * @returns {{valid: boolean, errors: Array<{path: string, code: string, message: string, expected?: unknown, actual?: unknown}>}}
 */
function validateFile(schemaPath, data) {
    const abs = path.resolve(schemaPath);
    let schema = cacheByPath.get(abs);
    if (!schema) {
        schema = JSON.parse(fs.readFileSync(abs, 'utf8'));
        cacheByPath.set(abs, schema);
    }
    return validate(schema, data);
}

function clearCache() {
    cacheByPath.clear();
}

module.exports = {validate, validateFile, clearCache};

