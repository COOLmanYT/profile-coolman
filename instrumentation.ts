export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { guardFetch } = await import('./lib/privacy-network.mjs')
    globalThis.fetch = guardFetch(globalThis.fetch)
  }
}
