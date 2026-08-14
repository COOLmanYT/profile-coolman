export function createTtlCache({ ttlMs, now = () => Date.now() }) {
  let cached = null
  let pending = null

  return {
    async get(load) {
      if (cached && cached.expiresAt > now()) return cached.value
      if (pending) return pending

      pending = Promise.resolve(load())
        .then((value) => {
          cached = { value, expiresAt: now() + ttlMs }
          return value
        })
        .finally(() => {
          pending = null
        })

      return pending
    },
    clear() {
      cached = null
    },
  }
}
