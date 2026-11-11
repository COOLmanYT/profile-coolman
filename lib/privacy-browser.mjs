import { PRIVACY_BLOCKED_PATH, PRIVACY_RUNTIME_CODE, trackerHosts, trackerPaths } from './privacy-policy.mjs'

// Register in the initial document so blocked loads are detected before hydration.
export function privacyBrowserGuard(vercelPreview = false) {
  return `(() => {
  const trackerHosts = ${JSON.stringify(trackerHosts)};
  const trackerPaths = ${trackerPaths};
  let blocked = false;
  const block = (directive, origin) => {
    if (blocked) return;
    blocked = true;
    console.error(new Error(${JSON.stringify(`${PRIVACY_RUNTIME_CODE}: blocked an unapproved advertising or tracking resource`)} + ' (' + directive + ' from ' + origin + ')'));
    location.replace(${JSON.stringify(PRIVACY_BLOCKED_PATH)});
  };
  document.addEventListener('securitypolicyviolation', (event) => {
    if (blocked || event.disposition !== 'enforce') return;
    if (/^(?:chrome|moz|safari-web)-extension:/i.test(event.sourceFile)) return;
    if (!/^(https?|wss?):\\/\\//i.test(event.blockedURI)) return;

    const url = new URL(event.blockedURI);
    if (${vercelPreview === true} && /^(?:script-src|script-src-elem)$/.test(event.effectiveDirective) && url.origin === 'https://vercel.live') {
      // The host injects this script into previews. Keep CSP blocking the load.
      const source = event.target?.tagName === 'SCRIPT' && event.target.src ? new URL(event.target.src) : url;
      if (source.origin === url.origin && source.pathname === '/_next-live/feedback/feedback.js') return;
    }
    const hostname = url.hostname.replace(/\\.$/, '');
    const knownTracker = trackerHosts.some(host => hostname === host || hostname.endsWith('.' + host));
    const activeResource = /^(?:script-src(?:-elem)?|connect-src|frame-src|worker-src|object-src)$/.test(event.effectiveDirective);
    if (!knownTracker && (!activeResource || url.host === location.host)) return;

    block(event.effectiveDirective, url.origin);
  });
  document.addEventListener('error', (event) => {
    const script = event.target;
    if (script?.tagName !== 'SCRIPT' || !script.src) return;
    const url = new URL(script.src);
    if (trackerPaths.test(url.pathname)) block('script-src', url.origin);
  }, true);
})();`
}
