import { assertPrivacyDestination } from './privacy-policy.mjs'
import { showPrivacyFailure } from './privacy-navigation.mjs'

const protectedFetches = new WeakSet()

/** @param {typeof fetch} fetcher @param {(error: unknown) => void} [onBlock] */
export function guardFetch(fetcher, onBlock) {
  if (protectedFetches.has(fetcher)) return fetcher
  // A proxy forwards Next.js fetch metadata and passes the original options through unchanged.
  const guarded = new Proxy(fetcher, {
    apply(target, receiver, args) {
      try {
        assertPrivacyDestination(args[0])
      } catch (error) {
        onBlock?.(error)
        return Promise.reject(error)
      }
      return Reflect.apply(target, receiver, args)
    },
  })
  protectedFetches.add(guarded)
  return guarded
}

/** @param {Parameters<typeof fetch>[0]} input @param {RequestInit} [init] @param {typeof fetch} [fetcher] */
export function privacyFetch(input, init, fetcher = globalThis.fetch) {
  try {
    assertPrivacyDestination(input)
  } catch (error) {
    if (typeof window !== 'undefined') showPrivacyFailure(window, error)
    return Promise.reject(error)
  }
  return fetcher(input, init)
}
