const { readFileSync } = require('node:fs')
const ts = require('typescript')

/** Requires TypeScript sources with the existing compiler, so tests need no extra framework. */
module.exports = function loadTs(load) {
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
    if (previous) require.extensions['.ts'] = previous
    else delete require.extensions['.ts']
  }
}
