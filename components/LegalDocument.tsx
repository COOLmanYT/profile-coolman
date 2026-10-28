'use client'

import { siteConfig } from '@/lib/site-config.mjs'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type DocumentKind = 'terms' | 'privacy'
const STORAGE_KEY = 'coolman-legal-simple-mode'
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || siteConfig.site.contactEmail

type Section = { title: string; body: string[] }

const TERMS: Record<'simple' | 'standard', Section[]> = {
  simple: [
    { title: 'Using this site', body: ['Please use the site respectfully and lawfully. Do not try to break it, overload it, impersonate anyone, or interfere with other people using it.'] },
    { title: 'Content and links', body: [`${siteConfig.profile.username} owns the original site content unless something says otherwise. You can share links to the site, but do not copy or reuse content as your own without permission.`, 'Links to Twitch, Spotify, Discord, X, YouTube and other services are their own services. Their rules apply when you use them.'] },
    { title: 'No promises', body: ['The profile, presence information and links are provided as they are. They may be unavailable, incomplete or change without notice.'] },
    { title: 'Changes and contact', body: [`These terms may change as the site changes. Continuing to use the site after a change means you accept the updated terms. For questions, email ${CONTACT_EMAIL}.`] },
  ],
  standard: [
    { title: 'Acceptance', body: ['By accessing or using this website, you agree to these Terms of Service. If you do not agree, please do not use the website.'] },
    { title: 'Permitted use', body: ['You may use the website for personal, lawful purposes. You must not attempt to disrupt, damage, reverse engineer, scrape at a harmful rate, bypass access controls, or use the website in a way that infringes another person’s rights.'] },
    { title: 'Intellectual property', body: [`Unless otherwise stated, the website design, original text, graphics and branding are owned by ${siteConfig.profile.username} or used with permission. You may share a link to the website. Any other use requires prior permission, except where permitted by law.`] },
    { title: 'Third-party services', body: [`The website includes or links to third-party services, including Discord, Spotify, Twitch, Vercel, Supabase, YouTube and social platforms. Those services are governed by their own terms and policies. ${siteConfig.profile.username} is not responsible for third-party content, availability or practices.`] },
    { title: 'Availability and liability', body: [`The website is provided on an “as is” and “as available” basis. To the extent permitted by law, ${siteConfig.profile.username} does not make warranties about accuracy, availability or fitness for a particular purpose. Nothing in these terms excludes rights that cannot legally be excluded.`] },
    { title: 'Changes and contact', body: [`${siteConfig.profile.username} may update these terms from time to time by publishing a revised version here. Your continued use after publication indicates acceptance of the revised terms. For questions, contact ${CONTACT_EMAIL}.`] },
  ],
}

const PRIVACY: Record<'simple' | 'standard', Section[]> = {
  simple: [
    { title: 'What this site collects', body: ['The public profile does not ask you to create an account. It uses a small cookie to avoid counting the same browser as a new view more than once every 24 hours. Options are kept in your browser.', 'When enabled by the owner, daily statistics can include approximate country, UTC visit hour, referring domain, clicked destination, and broad device, operating system and browser families. These breakdowns store counts, without IP addresses, visitor identifiers, raw user agents or URL queries and fragments.', 'If you sign in to the Dashboard, supported sign-in providers supply the account details needed to authenticate authorised Dashboard users.'] },
    { title: 'Profile likes', body: ['A random browser token and a liked marker are saved in a cookie and browser storage so your browser can like the profile once. The server stores a hash of that token and the like total. The cookie is renewed on visits for up to 400 days; your browser may remove it earlier. Clearing both forms of storage or using another browser can reset this memory.'] },
    { title: 'Services involved', body: ['The site uses Vercel to run the site and provide approximate country information, Supabase to store site settings and aggregate statistics, and Discord, Spotify, Twitch and YouTube to show creator information. Turning on the optional YouTube player connects your browser to YouTube. Those providers may process technical information under their own policies.'] },
    { title: 'Your choices', body: [`Optional breakdown collection respects browser Do Not Track and Global Privacy Control signals by default. The basic view and like counters still operate. You can clear cookies and browser storage in your browser settings. You can use Simple Mode without giving us any extra information. For privacy questions or requests, email ${CONTACT_EMAIL}.`] },
  ],
  standard: [
    { title: 'Scope', body: [`This Privacy Policy explains how ${siteConfig.profile.username}’s profile website handles personal information and related technical data. It should be read with the privacy policies of third-party services linked from or integrated into the website.`] },
    { title: 'Information we collect', body: ['The public website does not require a visitor account or contact form. It sets a first-party cookie named profile_view_counted to prevent repeated view counts for 24 hours. Options such as module visibility and legal reading mode are stored locally in the visitor’s browser.', 'The owner can enable or disable aggregate breakdowns for approximate country, UTC hour, referring domain, clicked public page or external domain, device type, operating system family and browser family. Each enabled category stores separate daily counts in the existing statistics, rather than linked visitor events. The breakdowns do not store IP addresses, visitor identifiers, raw user agents, precise location, full referrer URLs, arbitrary destination paths, query strings or fragments. Basic view and like totals are separate from these optional categories.', 'Dashboard sign-in uses supported OAuth providers to verify authorised users. The public presence widgets retrieve creator information from Discord/Lanyard, Spotify and Twitch; they are not intended to identify visitors.'] },
    { title: 'How information is used and stored', body: ['Cookie and local browser settings are used for site operation and preferences. Aggregated statistics and site configuration are stored through Supabase and are readable only by authorised Dashboard users through the website. Optional breakdown collection respects Do Not Track and Global Privacy Control by default, subject to the owner’s published configuration. Disabling a category stops future collection; existing daily aggregates remain available. Vercel and other infrastructure providers may process technical requests and operational logs to provide and secure the website under their own policies.'] },
    { title: 'Likes and optional players', body: ['The profile_like_browser cookie and local browser storage retain a randomly generated browser token and a liked marker to prevent repeated likes. The server stores a SHA-256 hash of the token, the time of the like and an aggregate total through Supabase. The cookie has a rolling maximum age of 400 days, subject to browser retention limits; local storage has no application expiry. This token is not derived from your account or device fingerprint. Clearing both cookie and local storage or changing browsers can allow another like.', 'The optional YouTube player is off by default unless the site owner changes the default or you enable it in Options. Enabling it loads a YouTube privacy-enhanced embed, which connects your browser to YouTube and is governed by its policies.'] },
    { title: 'Sharing and overseas processing', body: ['Information may be processed by service providers that operate infrastructure in Australia and other countries, including Vercel, Supabase, Discord, Spotify and Twitch. These providers process information under their own terms and privacy policies. We do not sell visitor personal information.'] },
    { title: 'Access, correction and complaints', body: [`You can clear the website’s cookie and local storage using your browser controls. For questions, access or correction requests, or privacy complaints, email ${CONTACT_EMAIL} and describe the request. We will consider it and respond within a reasonable time.`] },
    { title: 'Changes', body: ['This policy may change when the website or its services change. The current version is published on this page.'] },
  ],
}

export default function LegalDocument({ kind, defaultSimpleMode }: { kind: DocumentKind; defaultSimpleMode: boolean }) {
  const [simpleMode, setSimpleMode] = useState(defaultSimpleMode)
  const title = kind === 'terms' ? 'Terms of Service' : 'Privacy Policy'
  const sections = (kind === 'terms' ? TERMS : PRIVACY)[simpleMode ? 'simple' : 'standard']

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'true' || saved === 'false') setSimpleMode(saved === 'true')
  }, [])

  const changeMode = (next: boolean) => {
    setSimpleMode(next)
    window.localStorage.setItem(STORAGE_KEY, String(next))
  }

  return (
    <main className="min-h-screen bg-[#151515] px-5 py-10 text-white">
      <article className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7">
        <Link href="/" className="text-xs text-white/45 hover:text-white">← Back to profile</Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-bold">{title}</h1><p className="mt-1 text-xs text-white/45">Last updated {kind === 'privacy' ? '29 October 2026' : '14 August 2026'}</p></div>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80">Simple Mode<input type="checkbox" checked={simpleMode} onChange={(event) => changeMode(event.target.checked)} className="h-4 w-4 accent-red-600" /></label>
        </div>
        <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-100/85">{simpleMode ? 'This is a plain-language summary. Switch Simple Mode off to read the full version.' : 'This page is general website terms and privacy information, not legal advice.'}</p>
        <div className="mt-6 space-y-6">{sections.map((section) => <section key={section.title}><h2 className="text-base font-semibold">{section.title}</h2>{section.body.map((paragraph) => <p key={paragraph} className="mt-2 text-sm leading-6 text-white/70">{paragraph}</p>)}</section>)}</div>
      </article>
    </main>
  )
}
