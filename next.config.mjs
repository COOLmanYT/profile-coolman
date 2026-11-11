import config from './site.config.json' with { type: 'json' }
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants.js'
import { configuredMediaOrigins, validateSiteConfig } from './lib/config-validation.mjs'

const mediaOrigins = configuredMediaOrigins(validateSiteConfig(config)).join(' ')

function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `img-src 'self' data: ${mediaOrigins} https://i.scdn.co https://*.scdn.co https://cdn.discordapp.com https://static-cdn.jtvnw.net https://i.ytimg.com https://yt3.googleusercontent.com https://yt3.ggpht.com https://cdn.simpleicons.org https://avatars.githubusercontent.com https://*.rbxcdn.com https://*.steamstatic.com https://cdn.buymeacoffee.com`,
    `media-src 'self' ${mediaOrigins}`,
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "connect-src 'self' wss://api.lanyard.rest",
    'frame-src https://open.spotify.com https://www.youtube-nocookie.com',
    'upgrade-insecure-requests',
  ].map(directive => directive.trim()).join('; ')
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    }]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
      },
      {
        protocol: 'https',
        hostname: '*.scdn.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      {
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
}

/** @param {string} phase @returns {Promise<import('next').NextConfig>} */
export default async function configureNext(phase) {
  if (phase !== PHASE_DEVELOPMENT_SERVER && phase !== PHASE_PRODUCTION_BUILD) return nextConfig

  const { auditPrivacy, privacyBuildError } = await import('./lib/privacy-audit.mjs')
  const findings = await auditPrivacy()
  if (findings.length) {
    const error = privacyBuildError(findings)
    if (phase === PHASE_PRODUCTION_BUILD) throw error
    console.error(error.message)
  }

  return { ...nextConfig, env: { PROFILE_PRIVACY_BUILD_BLOCKED: findings.length ? '1' : '0' } }
}
