const { readFileSync } = require('node:fs')
const ts = require('typescript')

/** Requires TypeScript sources with the existing compiler, so tests need no extra framework. */
const Module = require('node:module')

module.exports = function loadTs(load) {
  // ESM sources import siblings as "./x.js" (needed on Vercel); resolve those to "./x.ts" here.
  const resolve = Module._resolveFilename
  Module._resolveFilename = function (request, ...rest) {
    try {
      return resolve.call(this, request, ...rest)
    } catch (error) {
      if (request.endsWith('.js')) return resolve.call(this, request.slice(0, -3) + '.ts', ...rest)
      throw error
    }
  }
  const previous = require.extensions['.ts']
  require.extensions['.ts'] = (module, filename) => {
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    })
    module._compile(outputText, filename)
  }
  try {
    return load()
  } finally {
    Module._resolveFilename = resolve
    if (previous) require.extensions['.ts'] = previous
    else delete require.extensions['.ts']
  }
}
