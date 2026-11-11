import { PRIVACY_BLOCKED_PATH, PRIVACY_RUNTIME_CODE, trackerHosts, trackerPaths } from './privacy-policy.mjs'

// Register in the initial document so blocked loads are detected before hydration.
export const privacyBrowserGuard = `(() => {
  const trackerHosts = ${JSON.stringify(trackerHosts)};
  const trackerPaths = ${trackerPaths};
  let blocked = false;
  const block = () => {
    if (blocked) return;
    blocked = true;
    console.error(new Error(${JSON.stringify(`${PRIVACY_RUNTIME_CODE}: blocked an unapproved advertising or tracking resource`)}));
    location.replace(${JSON.stringify(PRIVACY_BLOCKED_PATH)});
  };
  document.addEventListener('securitypolicyviolation', (event) => {
    if (blocked || event.disposition !== 'enforce') return;
    if (/^(?:chrome|moz|safari-web)-extension:/i.test(event.sourceFile)) return;
    if (!/^(https?|wss?):\\/\\//i.test(event.blockedURI)) return;

    const url = new URL(event.blockedURI);
    const hostname = url.hostname.replace(/\\.$/, '');
    const knownTracker = trackerHosts.some(host => hostname === host || hostname.endsWith('.' + host));
    const activeResource = /^(?:script-src(?:-elem)?|connect-src|frame-src|worker-src|object-src)$/.test(event.effectiveDirective);
    if (!knownTracker && (!activeResource || url.host === location.host)) return;

    block();
  });
  document.addEventListener('error', (event) => {
    const script = event.target;
    if (script?.tagName === 'SCRIPT' && script.src && trackerPaths.test(new URL(script.src).pathname)) block();
  }, true);
})();`
