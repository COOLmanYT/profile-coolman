import { guardFetch } from './privacy-network.mjs'
import { assertPrivacyDestination } from './privacy-policy.mjs'
import { showPrivacyFailure } from './privacy-navigation.mjs'

const guardedWindows = new WeakSet()

/** @param {Window & typeof globalThis} scope */
export function installPrivacyNetworkGuard(scope) {
  if (guardedWindows.has(scope)) return
  guardedWindows.add(scope)

  const onBlock = error => showPrivacyFailure(scope, error)

  scope.fetch = guardFetch(scope.fetch, onBlock)
  if (typeof scope.navigator.sendBeacon === 'function') {
    scope.navigator.sendBeacon = new Proxy(scope.navigator.sendBeacon, {
      apply(target, receiver, args) {
        try {
          assertPrivacyDestination(args[0])
        } catch (error) {
          onBlock(error)
          return false
        }
        return Reflect.apply(target, receiver, args)
      },
    })
  }

  scope.XMLHttpRequest.prototype.open = new Proxy(scope.XMLHttpRequest.prototype.open, {
    apply(target, receiver, args) {
      try {
        assertPrivacyDestination(args[1])
      } catch (error) {
        onBlock(error)
        throw error
      }
      return Reflect.apply(target, receiver, args)
    },
  })
}
