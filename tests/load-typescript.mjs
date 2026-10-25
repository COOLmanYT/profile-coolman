import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as siteConfig from '../lib/site-config.mjs'

// Execute the real route code with explicit local dependencies, never live services.
export function loadTypescript(path, dependencies) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  const require = (id) => {
    if (id === '@/lib/site-config.mjs' || id === './site-config.mjs') return dependencies[id] ?? siteConfig
    if (!(id in dependencies)) throw new Error(`Unmocked dependency: ${id}`)
    return dependencies[id]
  }
  new Function('require', 'exports', outputText)(require, exports)
  return exports
}

export const nextServer = { NextResponse: { json: (body, options) => Response.json(body, options) } }
