import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isTrackerDestination, PRIVACY_BLOCKED_PATH, trackerPathPrefixes } from './privacy-policy.mjs'

export function renderedPrivacyIssues(html) {
  const issues = new Set()
  const markup = html.replace(/<!--[\s\S]*?-->/g, '')
  for (const [, tag, attributes] of markup.matchAll(/<(script|iframe|img|source|link|ins)\b([^>]*)>/gi)) {
    const lowerTag = tag.toLowerCase()
    const resources = attributes.matchAll(/(?:^|\s)(?:src|srcset|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)
    for (const [, doubleQuoted, singleQuoted, unquoted] of resources) {
      const value = doubleQuoted ?? singleQuoted ?? unquoted
      if (value.split(/[,\s]+/).some(isTrackerDestination)) issues.add('rendered advertising or tracking resource')
      if (lowerTag === 'script' && /^(?:https?:)?\/\//i.test(value.trim())) issues.add('rendered externally hosted script')
    }
    if (lowerTag === 'ins' && /\b(?:adsbygoogle|data-ad-client)\b/i.test(attributes)) issues.add('rendered advertising markup')
  }
  for (const [, script] of markup.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\b(?:gtag|fbq)\s*\(/.test(script)) issues.add('rendered tracking snippet')
  }
  return [...issues]
}

async function auditHtml(directory, prefix, issues) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    const relativePath = `${prefix}${entry.name}`
    if (entry.isDirectory()) await auditHtml(path, `${relativePath}/`, issues)
    if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = await readFile(path, 'utf8')
      for (const issue of renderedPrivacyIssues(html)) issues.push(`${relativePath}: ${issue}`)
      if (relativePath === 'server/app/index.html' && !/<script\b[^>]*>[^<]*securitypolicyviolation[^<]*<\/script>/i.test(html)) {
        issues.push(`${relativePath}: the early browser privacy guard is missing`)
      }
    }
  }
}

export async function auditPrivacyOutput(buildDirectory) {
  const issues = []
  const [routes, appPaths] = await Promise.all([
    readFile(join(buildDirectory, 'routes-manifest.json'), 'utf8').then(JSON.parse),
    readFile(join(buildDirectory, 'app-path-routes-manifest.json'), 'utf8').then(JSON.parse),
  ])
  if (appPaths[`${PRIVACY_BLOCKED_PATH}/route`] !== PRIVACY_BLOCKED_PATH) issues.push('the standalone privacy failure route is missing')

  const policies = routes.headers.flatMap(rule => rule.headers
    .filter(header => header.key.toLowerCase() === 'content-security-policy')
    .map(header => ({ source: rule.source, value: header.value })))
  const base = routes.basePath ?? ''
  const catchAll = `${base}/:path*`
  const scriptPolicy = policies.find(header => header.source === catchAll && /(?:^|;)\s*script-src\s+'self'(?:\s+'unsafe-inline')?\s*(?:;|$)/.test(header.value))
  if (!scriptPolicy) issues.push('the production Content Security Policy must restrict scripts to local and inline sources')
  if (policies.some(header => header.value.split(/[\s;]+/).some(isTrackerDestination))) issues.push('a production Content Security Policy allows a tracker destination')

  const rewrites = routes.rewrites?.beforeFiles ?? []
  for (const prefix of trackerPathPrefixes) {
    if (!rewrites.some(rule => rule.source === `${base}${prefix}/:path*` && rule.destination === `${base}${PRIVACY_BLOCKED_PATH}`)) {
      issues.push(`the production fallback rewrite is missing for ${prefix}`)
    }
  }

  await auditHtml(join(buildDirectory, 'server', 'app'), 'server/app/', issues)
  return issues.sort()
}
