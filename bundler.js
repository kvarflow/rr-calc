'use strict';

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const terser = require('terser');

const config = {
  compact: false,
  plugins: [
    ['@babel/plugin-transform-typescript', {'isTSX': true}],
    ['@babel/plugin-proposal-class-properties', {'loose': true}],
    ['@babel/plugin-proposal-optional-chaining', {'loose': true}],
    ['@babel/plugin-proposal-object-rest-spread', {'loose': true, 'useBuiltIns': true}],
    '@babel/plugin-proposal-optional-catch-binding',
    '@babel/plugin-transform-arrow-functions',
    ['@babel/plugin-transform-block-scoping', {'throwIfClosureRequired': true}],
    ['@babel/plugin-transform-classes', {'loose': true}],
    ['@babel/plugin-transform-computed-properties', {'loose': true}],
    ['@babel/plugin-transform-destructuring', {'loose': true, 'useBuiltIns': true}],
    ['@babel/plugin-transform-for-of', {'assumeArray': true}],
    '@babel/plugin-transform-literals',
    '@babel/plugin-transform-parameters',
    '@babel/plugin-transform-shorthand-properties',
    ['@babel/plugin-transform-spread', {'loose': true}],
    ['@babel/plugin-transform-template-literals', {'loose': true}],
    '@babel/plugin-transform-member-expression-literals',
    '@babel/plugin-transform-property-literals'
  ],
}

class Bundler {
  constructor(dirname) {
    this.built = path.resolve(dirname, 'dist');
  }

  read(f) {
    try {
      return fs.readFileSync(path.join(this.built, f), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.error(`Missing file 'dist/${f}' - did you run \`npm run compile\`?`);
        process.exit(1);
      }
      throw err;
    }
  }

  // Splits a CommonJS module emitted by tsc into its parts by content rather than by
  // line number, so that changes to the source (or to which helpers tsc emits) do not
  // break the bundle:
  //
  //   "use strict";
  //   var __assign = (this && this.__assign) || function () { ... };   <- helpers
  //   var _a, _b;                                                     <- prelude
  //   exports.__esModule = true;
  //   exports.Foo = exports.Bar = void 0;
  //   var util_1 = require("../util");                                <- aliases
  //   ...                                                             <- body
  //   //# sourceMappingURL=foo.js.map
  module(f) {
    const lines = this.read(f).replace(/\r\n/g, '\n').split('\n');
    const helpers = new Map();
    const aliases = [];
    const prelude = [];
    let i = 0;

    if (/^\s*["']use strict["'];\s*$/.test(lines[i])) i++;

    // Helpers and any other top-level code before the __esModule marker.
    const esModule = /^(exports\.__esModule = true;|Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);)$/;
    const helperStart = /^var (__\w+) = \(this && this\.\1\) \|\|/;
    for (; i < lines.length && !esModule.test(lines[i]); i++) {
      const m = helperStart.exec(lines[i]);
      if (!m) {
        prelude.push(lines[i]);
        continue;
      }
      const start = i;
      // A helper ends at the first line that closes the top-level expression. Most are
      // multi-line and end with `};`, but some (e.g. __createBinding) end with `}));`
      // and a few fit on a single line.
      while (i < lines.length && !/^\S.*;$/.test(lines[i]) && !/^}\)*;$/.test(lines[i])) i++;
      if (!helpers.has(m[1])) helpers.set(m[1], lines.slice(start, i + 1).join('\n'));
    }
    if (i >= lines.length) throw new Error(`dist/${f}: could not find the __esModule marker`);
    i++;

    // `exports.X = exports.Y = void 0;` (may be absent for modules without exports).
    while (i < lines.length && /^exports\.[\w$]+ = .*void 0;$/.test(lines[i])) i++;

    // `var foo_1 = require("./foo");`
    for (let m; i < lines.length && (m = /^var ([\w$]+) = require\("[^"]+"\);$/.exec(lines[i])); i++) {
      aliases.push(m[1]);
    }

    let end = lines.length;
    while (end > i && (lines[end - 1].trim() === '' || lines[end - 1].startsWith('//# sourceMappingURL='))) end--;
    const body = lines.slice(i, end);
    if (body.some(l => /\brequire\(/.test(l))) {
      throw new Error(`dist/${f}: unexpected require() in module body`);
    }

    return {helpers, prelude: prelude.join('\n'), aliases, body: body.join('\n')};
  }

  // Concatenates modules so that they all share one `exports` object (which the caller
  // must declare). tsc's helpers are emitted once each, up front. Each module body runs
  // in its own function scope, so top-level names that several modules declare (e.g. the
  // per-generation tables in data/*.js) do not clobber each other, and each `require`
  // alias inside it is simply another name for the shared `exports` object.
  concat(files) {
    const helpers = new Map();
    const parts = [];
    for (const f of files) {
      const mod = this.module(f);
      for (const [name, code] of mod.helpers) if (!helpers.has(name)) helpers.set(name, code);
      parts.push(`// ${f}\n(function () {`);
      if (mod.prelude.trim()) parts.push(mod.prelude);
      if (mod.aliases.length) parts.push(mod.aliases.map(a => `var ${a} = exports;`).join('\n'));
      parts.push(mod.body, '})();');
    }
    return [...helpers.values(), ...parts].join('\n') + '\n';
  }

  async bundle(bundled, output = 'production.min.js') {
    bundled = babel.transformSync(bundled, config).code;
    bundled = (await terser.minify(bundled)).code;
    fs.writeFileSync(path.join(this.built, output), bundled);
  }
}

module.exports = Bundler;
