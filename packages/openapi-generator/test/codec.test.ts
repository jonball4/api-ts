import * as E from 'fp-ts/lib/Either';
import assert from 'node:assert';
import test from 'node:test';

import { TestProject } from './testProject';
import { parsePlainInitializer, type Schema } from '../src';

async function testCase(
  description: string,
  src: string,
  expected: Record<string, Schema>,
  expectedErrors: string[] = [],
) {
  test(description, async () => {
    const project = new TestProject({ '/index.ts': src });
    await project.parseEntryPoint('/index.ts');
    const sourceFile = project.get('/index.ts');
    if (sourceFile === undefined) {
      throw new Error('Source file not found');
    }

    const actual: Record<string, Schema> = {};
    const errors: string[] = [];
    for (const symbol of sourceFile.symbols.declarations) {
      if (symbol.init !== undefined) {
        const result = parsePlainInitializer(project, sourceFile, symbol.init);
        if (E.isLeft(result)) {
          errors.push(result.left);
        } else {
          if (symbol.comment !== undefined) {
            result.right.comment = symbol.comment;
          }
          actual[symbol.name] = result.right;
        }
      }
    }

    assert.deepStrictEqual(errors, expectedErrors);
    assert.deepStrictEqual(actual, expected);
  });
}

const SIMPLE = `
import * as t from 'io-ts';
export const FOO = t.number;
`;

testCase('simple codec is parsed', SIMPLE, {
  FOO: { type: 'number' },
});

const DIRECT = `
import { number } from 'io-ts';
export const FOO = number;
`;

testCase('direct import is parsed', DIRECT, {
  FOO: { type: 'number' },
});

const TYPE = `
import * as t from 'io-ts';
export const FOO = t.type({ foo: t.number });
`;

testCase('type is parsed', TYPE, {
  FOO: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
});

const PARTIAL = `
import * as t from 'io-ts';
export const FOO = t.partial({ foo: t.number });
`;

testCase('partial type is parsed', PARTIAL, {
  FOO: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: [],
  },
});

const SHORTHAND_PROPERTY = `
import * as t from 'io-ts';
export const bar = t.number;
export const FOO = t.type({ bar });
`;

testCase('shorthand property is parsed', SHORTHAND_PROPERTY, {
  bar: { type: 'number' },
  FOO: {
    type: 'object',
    properties: { bar: { type: 'number' } },
    required: ['bar'],
  },
});

const SPREAD_PROPERTY = `
import * as t from 'io-ts';
export const foo = {
  foo: t.number,
};
export const TEST = t.type({ ...foo, bar: t.string });
`;

testCase('spread property is parsed', SPREAD_PROPERTY, {
  foo: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
  TEST: {
    type: 'object',
    properties: {
      foo: { type: 'number' },
      bar: { type: 'string' },
    },
    required: ['foo', 'bar'],
  },
});

const CONST_ASSERTION = `
import * as t from 'io-ts';
const props = { foo: t.number } as const;
export const FOO = t.type(props);
`;

testCase('const assertion is parsed', CONST_ASSERTION, {
  FOO: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
  props: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
});

const SPREAD_CONST_ASSERTION = `
import * as t from 'io-ts';
const props = { foo: t.number } as const;
export const FOO = t.type({
  ...props,
});
`;

testCase('spread const assertion is parsed', SPREAD_CONST_ASSERTION, {
  FOO: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
  props: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
});

const AS_ASSERTION = `
import * as t from 'io-ts';
const props = { foo: t.number } as { foo: t.NumberC };
export const FOO = t.type(props);
`;

testCase('as assertion is parsed', AS_ASSERTION, {
  FOO: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
  props: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
});

const SPREAD_AS_ASSERTION = `
import * as t from 'io-ts';
const props = { foo: t.number } as { foo: t.NumberC };
export const FOO = t.type({
  ...props,
});
`;

testCase('spread const assertion is parsed', SPREAD_AS_ASSERTION, {
  FOO: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
  props: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
});

const ARRAY = `
import * as t from 'io-ts';
export const FOO = t.array(t.number);
`;

testCase('array type is parsed', ARRAY, {
  FOO: { type: 'array', items: { type: 'number' } },
});

const UNION = `
import * as t from 'io-ts';
export const FOO = t.union([t.string, t.number]);
`;

testCase('union type is parsed', UNION, {
  FOO: {
    type: 'union',
    schemas: [{ type: 'string' }, { type: 'number' }],
  },
});

const UNION_SPREAD = `
import * as t from 'io-ts';

const common = [t.string];

export const FOO = t.union([...common, t.number]);
`;

testCase('union type with spread is parsed', UNION_SPREAD, {
  FOO: {
    type: 'union',
    schemas: [{ type: 'string' }, { type: 'number' }],
  },
  common: {
    type: 'tuple',
    schemas: [{ type: 'string' }],
  },
});

const UNION_INLINE_SPREAD = `
import * as t from 'io-ts';

export const FOO = t.union([...[t.string], t.number]);
`;

testCase('union type with inline spread is parsed', UNION_INLINE_SPREAD, {
  FOO: {
    type: 'union',
    schemas: [{ type: 'string' }, { type: 'number' }],
  },
});

const INTERSECTION = `
import * as t from 'io-ts';
export const FOO = t.intersection([t.type({ foo: t.number }), t.partial({ bar: t.string })]);
`;

testCase('intersection type is parsed', INTERSECTION, {
  FOO: {
    type: 'intersection',
    schemas: [
      {
        type: 'object',
        properties: { foo: { type: 'number' } },
        required: ['foo'],
      },
      {
        type: 'object',
        properties: { bar: { type: 'string' } },
        required: [],
      },
    ],
  },
});

const RECORD = `
import * as t from 'io-ts';
export const FOO = t.record(t.string, t.number);
`;

testCase('record type is parsed', RECORD, {
  FOO: { type: 'record', codomain: { type: 'number' } },
});

const ENUM = `
import * as t from 'io-ts';
enum Foo {
  Foo = 'foo',
  Bar = 'bar',
}
export const TEST = t.keyof(Foo);
`;

testCase('enum type is parsed', ENUM, {
  Foo: {
    type: 'object',
    properties: {
      Foo: { type: 'string', enum: ['foo'] },
      Bar: { type: 'string', enum: ['bar'] },
    },
    required: ['Foo', 'Bar'],
  },
  TEST: {
    type: 'union',
    schemas: [
      { type: 'string', enum: ['Foo'] },
      { type: 'string', enum: ['Bar'] },
    ],
  },
});

const STRING_LITERAL = `
import * as t from 'io-ts';
export const FOO = t.literal('foo');
`;

testCase('string literal type is parsed', STRING_LITERAL, {
  FOO: { type: 'string', enum: ['foo'] },
});

const NUMBER_LITERAL = `
import * as t from 'io-ts';
export const FOO = t.literal(42);
`;

testCase('number literal type is parsed', NUMBER_LITERAL, {
  FOO: { type: 'number', enum: [42] },
});

const BOOLEAN_LITERAL = `
import * as t from 'io-ts';
export const FOO = t.literal(true);
`;

testCase('boolean literal type is parsed', BOOLEAN_LITERAL, {
  FOO: { type: 'boolean', enum: [true] },
});

const NULL_LITERAL = `
import * as t from 'io-ts';
export const FOO = t.literal(null);
`;

testCase('null literal type is parsed', NULL_LITERAL, {
  FOO: { type: 'null', enum: [null] },
});

const UNDEFINED_LITERAL = `
import * as t from 'io-ts';
export const FOO = t.undefined;
`;

testCase('undefined literal type is parsed', UNDEFINED_LITERAL, {
  FOO: { type: 'undefined' },
});

const KEYOF = `
import * as t from 'io-ts';
export const FOO = t.keyof({ foo: null, bar: null });
`;

testCase('keyof type is parsed', KEYOF, {
  FOO: {
    type: 'union',
    schemas: [
      { type: 'string', enum: ['foo'] },
      { type: 'string', enum: ['bar'] },
    ],
  },
});

const ALIAS = `
import { string as test } from 'io-ts';
export const FOO = test;
`;

testCase('aliased import is parsed', ALIAS, {
  FOO: { type: 'string' },
});

const BRAND = `
import * as t from 'io-ts';
interface FooBrand {
  readonly Foo: unique symbol;
}
export type FooBranded = t.Branded<string, FooBrand>;
export const FOO = t.brand(t.string, (s): s is FooBranded => s === 'foo', 'Foo');
`;

testCase('brand type is parsed', BRAND, {
  FOO: { type: 'string' },
});

const LOCAL_REF = `
import * as t from 'io-ts';
const FOO = t.type({ foo: t.number });
export const BAR = t.type({ bar: FOO });
`;

testCase('local ref is parsed', LOCAL_REF, {
  FOO: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
  BAR: {
    type: 'object',
    properties: { bar: { type: 'ref', name: 'FOO', location: '/index.ts' } },
    required: ['bar'],
  },
});

const LOCAL_EXPORTED_REF = `
import * as t from 'io-ts';
export const FOO = t.type({ foo: t.number });
export const BAR = t.type({ bar: FOO });
`;

testCase('local exported ref is parsed', LOCAL_EXPORTED_REF, {
  FOO: {
    type: 'object',
    properties: { foo: { type: 'number' } },
    required: ['foo'],
  },
  BAR: {
    type: 'object',
    properties: { bar: { type: 'ref', name: 'FOO', location: '/index.ts' } },
    required: ['bar'],
  },
});

const IMPORT_REF = `
import * as t from 'io-ts';
import { AnotherType } from 'another-library';
export const FOO = t.type({ foo: AnotherType });
`;

testCase('imported ref is parsed', IMPORT_REF, {
  FOO: {
    type: 'object',
    properties: {
      foo: { type: 'ref', name: 'AnotherType', location: 'another-library' },
    },
    required: ['foo'],
  },
});

const STAR_IMPORT_REF = `
import * as u from 'unknown-library';
export const FOO = u.thing({ foo: u.number });
`;

testCase('star imported ref is parsed', STAR_IMPORT_REF, {
  FOO: {
    type: 'ref',
    name: 'thing',
    location: 'unknown-library',
  },
});

const DECLARATION_COMMENT = `
import * as t from 'io-ts';

/**
 * Test codec
 */
export const FOO = t.number;
`;

testCase('declaration comment is parsed', DECLARATION_COMMENT, {
  FOO: {
    type: 'number',
    comment: {
      description: 'Test codec',
      tags: [],
      source: [
        {
          number: 0,
          source: '/**',
          tokens: {
            start: '',
            delimiter: '/**',
            postDelimiter: '',
            tag: '',
            postTag: '',
            name: '',
            postName: '',
            type: '',
            postType: '',
            description: '',
            end: '',
            lineEnd: '',
          },
        },
        {
          number: 1,
          source: ' * Test codec',
          tokens: {
            start: ' ',
            delimiter: '*',
            postDelimiter: ' ',
            tag: '',
            postTag: '',
            name: '',
            postName: '',
            type: '',
            postType: '',
            description: 'Test codec',
            end: '',
            lineEnd: '',
          },
        },
        {
          number: 2,
          source: ' */',
          tokens: {
            start: ' ',
            delimiter: '',
            postDelimiter: '',
            tag: '',
            postTag: '',
            name: '',
            postName: '',
            type: '',
            postType: '',
            description: '',
            end: '*/',
            lineEnd: '',
          },
        },
      ],
      problems: [],
    },
  },
});

const FIRST_PROPERTY_COMMENT = `
import * as t from 'io-ts';
export const FOO = t.type({
  /** this is a comment */
  foo: t.number,
});
`;

testCase('first property comment is parsed', FIRST_PROPERTY_COMMENT, {
  FOO: {
    type: 'object',
    properties: {
      foo: {
        type: 'number',
        comment: {
          description: 'this is a comment',
          problems: [],
          source: [
            {
              number: 1,
              source: '  /** this is a comment */',
              tokens: {
                delimiter: '/**',
                description: 'this is a comment ',
                end: '*/',
                lineEnd: '',
                name: '',
                postDelimiter: ' ',
                postName: '',
                postTag: '',
                postType: '',
                start: '  ',
                tag: '',
                type: '',
              },
            },
          ],
          tags: [],
        },
      },
    },
    required: ['foo'],
  },
});

const SECOND_PROPERTY_COMMENT = `
import * as t from 'io-ts';
export const FOO = t.type({
  foo: t.number,
  /** this is a comment */
  bar: t.string,
});
`;

testCase('second property comment is parsed', SECOND_PROPERTY_COMMENT, {
  FOO: {
    type: 'object',
    properties: {
      foo: { type: 'number' },
      bar: {
        type: 'string',
        comment: {
          description: 'this is a comment',
          problems: [],
          source: [
            {
              number: 1,
              source: '  /** this is a comment */',
              tokens: {
                delimiter: '/**',
                description: 'this is a comment ',
                end: '*/',
                lineEnd: '',
                name: '',
                postDelimiter: ' ',
                postName: '',
                postTag: '',
                postType: '',
                start: '  ',
                tag: '',
                type: '',
              },
            },
          ],
          tags: [],
        },
      },
    },
    required: ['foo', 'bar'],
  },
});

const OPTIONAL_COMBINATOR = `
import * as t from 'io-ts';
import * as h from '@api-ts/io-ts-http';
export const FOO = h.optional(t.string);
`;

testCase('optional combinator is parsed', OPTIONAL_COMBINATOR, {
  FOO: {
    type: 'union',
    schemas: [{ type: 'string' }, { type: 'undefined' }],
  },
});

const OPTIONALIZED_COMBINATOR = `
import * as t from 'io-ts';
import * as h from '@api-ts/io-ts-http';
export const FOO = h.optionalized({
  foo: t.string,
  bar: h.optional(t.number),
});
`;

testCase('optionalized combinator is parsed', OPTIONALIZED_COMBINATOR, {
  FOO: {
    type: 'object',
    properties: {
      foo: { type: 'string' },
      bar: {
        type: 'union',
        schemas: [{ type: 'number' }, { type: 'undefined' }],
      },
    },
    required: ['foo'],
  },
});

const HTTP_REQUEST_COMBINATOR = `
import * as t from 'io-ts';
import * as h from '@api-ts/io-ts-http';
export const FOO = h.httpRequest({
  params: {
    foo: t.string
  },
  query: {
    bar: h.optional(t.number)
  }
});
`;

testCase('httpRequest combinator is parsed', HTTP_REQUEST_COMBINATOR, {
  FOO: {
    type: 'object',
    properties: {
      params: {
        type: 'object',
        properties: { foo: { type: 'string' } },
        required: ['foo'],
      },
      query: {
        type: 'object',
        properties: {
          bar: {
            type: 'union',
            schemas: [{ type: 'number' }, { type: 'undefined' }],
          },
        },
        required: [],
      },
    },
    required: ['params', 'query'],
  },
});

const OBJECT_PROPERTY = `
import * as t from 'io-ts';

const props = {
  foo: t.number,
  bar: t.string,
};

export const FOO = t.type({
  baz: props.foo,
});
`;

testCase('object property is parsed', OBJECT_PROPERTY, {
  FOO: {
    type: 'object',
    properties: {
      baz: { type: 'number' },
    },
    required: ['baz'],
  },
  props: {
    type: 'object',
    properties: {
      foo: { type: 'number' },
      bar: { type: 'string' },
    },
    required: ['foo', 'bar'],
  },
});

const OBJECT_ASSIGN = `
import * as t from 'io-ts';

const props = Object.assign({}, {
  foo: t.number,
  bar: t.string,
});

export const FOO = t.type(props);
`;

testCase('object assign is parsed', OBJECT_ASSIGN, {
  FOO: {
    type: 'object',
    properties: {
      foo: { type: 'number' },
      bar: { type: 'string' },
    },
    required: ['foo', 'bar'],
  },
  props: {
    type: 'object',
    properties: {
      foo: { type: 'number' },
      bar: { type: 'string' },
    },
    required: ['foo', 'bar'],
  },
});
