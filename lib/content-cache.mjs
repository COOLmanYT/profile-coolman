import { createHash } from 'node:crypto'

// Retain only digests and small parsed results, never the provider's raw HTML.
// Content changes invalidate immediately; upstream fetches still control freshness.
export function createContentCache({ maxEntries = 16 } = {}) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new RangeError('maxEntries must be a positive integer')
  /** @type {Map<string, { digest: string, value: unknown }>} */
  const entries = new Map()

  return {
    /**
     * @template T
     * @param {string} key Include any parser options that affect the result.
     * @param {string} source
     * @param {(source: string) => T} parse
     * @returns {T}
     */
    get(key, source, parse) {
      const digest = createHash('sha256').update(source).digest('hex')
      const cached = entries.get(key)
      const value = cached?.digest === digest ? /** @type {T} */ (cached.value) : parse(source)
      entries.delete(key)
      entries.set(key, { digest, value })
      if (entries.size > maxEntries) entries.delete(entries.keys().next().value)
      return value
    },
  }
}
