import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Existing hydration and timer effects intentionally initialize client-only state.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'no-restricted-imports': ['error', {
        paths: ['@next/third-parties', '@next/third-parties/google'].map(name => ({
          name,
          importNames: ['GoogleAnalytics', 'GoogleTagManager', 'sendGAEvent', 'sendGTMEvent'],
          message: 'USER-PRIVACY-ERR-LINT: Google Analytics and Tag Manager are prohibited.',
        })),
        patterns: [{
          regex: '^(?:@vercel/(?:analytics|speed-insights)|react-ga4?|react-gtm-module|posthog-(?:js|node)|mixpanel(?:-browser)?|@segment/analytics[^/]*|react-adsense)(?:/|$)',
          message: 'USER-PRIVACY-ERR-LINT: advertising and third-party tracking imports are prohibited.',
        }],
      }],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
])
