import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { isTrackerDestination, privacyEnvironmentViolation, PRIVACY_BUILD_CODE } from './privacy-policy.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const ignoredDirectories = new Set(['node_modules', 'tests', 'docs', 'coverage', 'build', 'dist', 'out'])
const codeExtension = /\.[cm]?[jt]sx?$/i
const assetExtension = /\.(?:html?|css|scss|svg|json|ya?ml|toml)$/i
const trackingPackage = /^(?:@vercel\/(?:analytics|speed-insights)|@segment\/analytics[^/]*|@amplitude\/analytics[^/]*|@plausible\/tracker|react-ga4?|react-gtm-module|gtag(?:\.js)?|google-analytics|google-tag-manager|posthog-(?:js|node)|mixpanel(?:-browser)?|plausible-tracker|hotjar|react-hotjar|react-facebook-pixel|@microsoft\/clarity|react-adsense)(?:\/|$)/i
const googleExports = /^(?:GoogleAnalytics|GoogleTagManager|sendGAEvent|sendGTMEvent)$/
const trackingCall = /^(?:gtag|fbq|uetq)$/
const snippet = /\b(?:gtag|fbq)\s*\(|\badsbygoogle\b|\bca-pub-\d{6,}\b/

function trackingUrlIn(value) {
  const urls = value.match(/(?:https?:\/\/|wss?:\/\/|(?<![:\w])\/\/)[^\s"'`<>;,(){}]+|\/(?:_vercel\/(?:insights|speed-insights)|cdn-cgi\/rum)\b[^\s"'`<>;,(){}]*/gi)
  return urls?.some(isTrackerDestination)
}

function sourceViolations(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const issues = new Set()
  const nextScriptNames = new Set(['script'])
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === 'next/script' && statement.importClause?.name) {
      nextScriptNames.add(statement.importClause.name.text)
    }
  }

  function visit(node) {
    const report = message => issues.add(`${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}: ${message}`)

    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text
      if (trackingPackage.test(specifier)) report('advertising or tracking package')
      if (specifier.startsWith('@next/third-parties') && /\b(?:GoogleAnalytics|GoogleTagManager|sendGAEvent|sendGTMEvent)\b/.test(node.getText(file))) report('Google Analytics or Tag Manager integration')
    }

    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteralToken(node)) {
      if (trackingUrlIn(node.text) || (node.text.startsWith('/') && isTrackerDestination(node.text))) report('advertising or tracking destination')
      if (snippet.test(node.text) && (node.text.includes('<script') || ts.isJsxExpression(node.parent) || ts.isJsxAttribute(node.parent))) report('advertising or tracking script or markup')
    }

    if (ts.isIdentifier(node) && node.text === 'adsbygoogle') report('advertising or tracking integration')
    if (ts.isPropertyAccessExpression(node) && googleExports.test(node.name.text)) report('Google Analytics or Tag Manager integration')
    if (ts.isCallExpression(node)) {
      const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression
      if (ts.isIdentifier(name) && trackingCall.test(name.text)) report('advertising or tracking call')
      const [specifier] = node.arguments
      if (specifier && ts.isStringLiteralLike(specifier) && (name.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(name) && name.text === 'require')) && trackingPackage.test(specifier.text)) report('advertising or tracking package')
    }

    if (ts.isJsxOpeningLikeElement(node) && nextScriptNames.has(node.tagName.getText(file))) {
      const src = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(file) === 'src')?.initializer
      const value = src && ts.isJsxExpression(src) ? src.expression : src
      if (value && ts.isStringLiteralLike(value) && /^(?:https?:)?\/\//i.test(value.text)) report('externally hosted script')
    }

    ts.forEachChild(node, visit)
  }

  visit(file)
  return issues
}

async function auditFiles(directory, prefix, findings) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const path = `${prefix}${entry.name}`
    const absolute = join(directory, entry.name)
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      await auditFiles(absolute, `${path}/`, findings)
    }
    if (!entry.isFile() || ['lib/privacy-audit.mjs', 'lib/privacy-policy.mjs'].includes(path)) continue

    if (codeExtension.test(path) && !path.endsWith('.d.ts')) {
      for (const issue of sourceViolations(path, await readFile(absolute, 'utf8'))) findings.add(issue)
    } else if (assetExtension.test(path)) {
      const source = await readFile(absolute, 'utf8')
      if (entry.name === 'package.json' || entry.name === 'package-lock.json') {
        for (const match of source.matchAll(/"([^"]+)"\s*:/g)) {
          const name = match[1].split('node_modules/').at(-1)
          if (trackingPackage.test(name)) findings.add(`${path}: advertising or tracking dependency (${name})`)
        }
      }
      const markup = /\.(?:html?|svg)$/i.test(path)
      const content = markup ? source.replace(/<!--[\s\S]*?-->/g, '') : source
      if (trackingUrlIn(content) || (markup && snippet.test(content))) findings.add(`${path}: advertising or tracking resource`)
      if (markup && /<script\b[^>]*\b(?:src|href)\s*=\s*['"](?:https?:)?\/\//i.test(content)) findings.add(`${path}: externally hosted script`)
    }
  }
}

export async function auditPrivacy(root = projectRoot, env = process.env) {
  const findings = new Set()
  const configurationIssue = privacyEnvironmentViolation(env)
  if (configurationIssue) findings.add(configurationIssue)
  await auditFiles(root, '', findings)
  return [...findings].sort()
}

export function privacyBuildError(findings) {
  return new Error(`${PRIVACY_BUILD_CODE}: ads and third-party trackers are prohibited\n${findings.map(issue => `  - ${issue}`).join('\n')}`)
}
