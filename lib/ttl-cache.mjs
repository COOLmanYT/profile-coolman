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
        .catch((error) => {
          // Serve the last good value (stale-while-error) when one exists so a
          // single upstream hiccup does not blank the widget for every
          // concurrent waiter. Only reject when there is no prior snapshot.
          if (cached) return cached.value
          throw error
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
