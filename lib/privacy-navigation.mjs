import { PRIVACY_BLOCKED_PATH } from './privacy-policy.mjs'

const redirected = new WeakSet()

/** @param {Window & typeof globalThis} scope @param {unknown} error */
export function showPrivacyFailure(scope, error) {
  if (redirected.has(scope)) return
  redirected.add(scope)
  scope.console.error(error)
  scope.location.replace(PRIVACY_BLOCKED_PATH)
}
