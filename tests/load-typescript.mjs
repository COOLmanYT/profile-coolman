import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Execute the real route code with explicit local dependencies, never live services.
export function loadTypescript(path, dependencies) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const exports = {}
  const require = (id) => {
    if (!(id in dependencies)) throw new Error(`Unmocked dependency: ${id}`)
    return dependencies[id]
  }
  new Function('require', 'exports', outputText)(require, exports)
  return exports
}

export const nextServer = { NextResponse: { json: (body, options) => Response.json(body, options) } }
