'use strict';

//GitHub@NDBlockConnect | BlockConnect@StarsailsClover


const assert = require('node:assert/strict');
const test = require('node:test');
const {validate} = require('../../src/schema/validate');

const baseSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: {
        name: {type: 'string', minLength: 1, maxLength: 32},
        age: {type: 'integer', minimum: 0, maximum: 150},
        role: {enum: ['admin', 'user', 'guest']},
        tags: {type: 'array', uniqueItems: true, items: {type: 'string'}}
    }
};

test('accepts a value that satisfies every keyword', () => {
    const result = validate(baseSchema, {name: 'Ada', age: 36, role: 'admin', tags: ['a', 'b']});
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
});

test('flags missing required property with a stable path', () => {
    const result = validate(baseSchema, {age: 36});
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-016' && e.path === 'name'));
});

test('flags unknown property when additionalProperties is false', () => {
    const result = validate(baseSchema, {name: 'Ada', secret: 'shh'});
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-017' && e.path === 'secret'));
});

test('flags type, range, and length errors together', () => {
    const result = validate(baseSchema, {name: '', age: -1, role: 'wizard'});
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-009'));
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-007'));
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-003'));
});
//GitHub@NDBlockConnect | BlockConnect@StarsailsClover

test('supports pattern and const', () => {
    const schema = {type: 'object', required: ['id'], properties: {id: {type: 'string', pattern: '^[a-z]+$'}, kind: {const: 'animal'}}};
    assert.equal(validate(schema, {id: 'ok', kind: 'animal'}).valid, true);
    assert.equal(validate(schema, {id: 'Bad', kind: 'animal'}).valid, false);
    assert.equal(validate(schema, {id: 'ok', kind: 'plant'}).valid, false);
});



test('supports enums and unique items', () => {
    const result = validate(baseSchema, {name: 'Ada', tags: ['a', 'a']});
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-013'));
});

test('resolves $ref to $defs', () => {
    const schema = {
        type: 'object',
        properties: {address: {$ref: '#/$defs/Address'}},
        $defs: {Address: {type: 'object', properties: {city: {type: 'string'}}, required: ['city'], additionalProperties: false}}
    };
    assert.equal(validate(schema, {address: {city: 'T'}}).valid, true);
    assert.equal(validate(schema, {address: {city: 12}}).valid, false);
    assert.equal(validate(schema, {address: {country: 'T'}}).valid, false);
});

test('supports nested arrays of objects', () => {
    const schema = {
        type: 'object',
        properties: {
            tags: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {name: {type: 'string', minLength: 1}},
                    required: ['name'],
                    additionalProperties: false
                }
            }
        }
    };
    const result = validate(schema, {tags: [{name: 'x'}, {name: ''}]});
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.code === 'SCHEMA-009' && e.path === 'tags[1].name'));
});

test('returns errors array, not thrown exception', () => {
    const result = validate(null, {});
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
});

