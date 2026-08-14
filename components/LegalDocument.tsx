'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type DocumentKind = 'terms' | 'privacy'
const STORAGE_KEY = 'coolman-legal-simple-mode'
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@coolmanyt.com'

type Section = { title: string; body: string[] }

const TERMS: Record<'simple' | 'standard', Section[]> = {
  simple: [
    { title: 'Using this site', body: ['Please use the site respectfully and lawfully. Do not try to break it, overload it, impersonate anyone, or interfere with other people using it.'] },
    { title: 'Content and links', body: ['COOLman owns the original site content unless something says otherwise. You can share links to the site, but do not copy or reuse content as your own without permission.', 'Links to Twitch, Spotify, Discord, X, YouTube and other services are their own services. Their rules apply when you use them.'] },
    { title: 'No promises', body: ['The profile, presence information and links are provided as they are. They may be unavailable, incomplete or change without notice.'] },
    { title: 'Changes and contact', body: [`These terms may change as the site changes. Continuing to use the site after a change means you accept the updated terms. For questions, email ${CONTACT_EMAIL}.`] },
  ],
  standard: [
    { title: 'Acceptance', body: ['By accessing or using this website, you agree to these Terms of Service. If you do not agree, please do not use the website.'] },
    { title: 'Permitted use', body: ['You may use the website for personal, lawful purposes. You must not attempt to disrupt, damage, reverse engineer, scrape at a harmful rate, bypass access controls, or use the website in a way that infringes another person’s rights.'] },
    { title: 'Intellectual property', body: ['Unless otherwise stated, the website design, original text, graphics and branding are owned by COOLman or used with permission. You may share a link to the website. Any other use requires prior permission, except where permitted by law.'] },
    { title: 'Third-party services', body: ['The website includes or links to third-party services, including Discord, Spotify, Twitch, Vercel, Supabase, YouTube and social platforms. Those services are governed by their own terms and policies. COOLman is not responsible for third-party content, availability or practices.'] },
    { title: 'Availability and liability', body: ['The website is provided on an “as is” and “as available” basis. To the extent permitted by law, COOLman does not make warranties about accuracy, availability or fitness for a particular purpose. Nothing in these terms excludes rights that cannot legally be excluded.'] },
    { title: 'Changes and contact', body: [`COOLman may update these terms from time to time by publishing a revised version here. Your continued use after publication indicates acceptance of the revised terms. For questions, contact ${CONTACT_EMAIL}.`] },
  ],
}

const PRIVACY: Record<'simple' | 'standard', Section[]> = {
  simple: [
    { title: 'What this site collects', body: ['The public profile does not ask you to create an account. It uses a small cookie to avoid counting the same browser as a new view more than once every 24 hours. Options are kept in your browser.', 'The site records anonymous counts of which type of social link is opened. It does not attach your name, account, email or a visitor ID to that event.', 'If you sign in to the Dashboard, Discord provides the account details needed to authenticate the owner.'] },
    { title: 'Services involved', body: ['The site uses Vercel to run the site and analytics, Supabase to store site settings and totals, and Discord, Spotify and Twitch to show profile and presence information. Those providers may process information under their own policies.'] },
    { title: 'Your choices', body: [`You can clear cookies and browser storage in your browser settings. You can use Simple Mode without giving us any extra information. For privacy questions or requests, email ${CONTACT_EMAIL}.`] },
  ],
  standard: [
    { title: 'Scope', body: ['This Privacy Policy explains how COOLman’s profile website handles personal information and related technical data. It should be read with the privacy policies of third-party services linked from or integrated into the website.'] },
    { title: 'Information we collect', body: ['The public website does not require a visitor account or contact form. It sets a first-party cookie named profile_view_counted to prevent repeated view counts for 24 hours. Options such as module visibility and legal reading mode are stored locally in the visitor’s browser.', 'The site records an anonymous outbound-link event containing only the selected platform name (for example, YouTube or Twitch). It does not include a visitor account, email address or user ID.', 'Dashboard sign-in uses Discord OAuth. For the authorised owner, authentication information supplied by Discord is used to verify access. The public presence widgets retrieve creator information from Discord/Lanyard, Spotify and Twitch; they are not intended to identify visitors.'] },
    { title: 'How information is used and stored', body: ['Cookie and local browser settings are used for site operation and preferences. Aggregated view totals and site configuration are stored through Supabase. Vercel may collect technical analytics and operational logs to provide and secure the website.'] },
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
          <div><h1 className="text-2xl font-bold">{title}</h1><p className="mt-1 text-xs text-white/45">Last updated 14 August 2026</p></div>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80">Simple Mode<input type="checkbox" checked={simpleMode} onChange={(event) => changeMode(event.target.checked)} className="h-4 w-4 accent-red-600" /></label>
        </div>
        <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-relaxed text-amber-100/85">{simpleMode ? 'This is a plain-language summary. Switch Simple Mode off to read the full version.' : 'This page is general website terms and privacy information, not legal advice.'}</p>
        <div className="mt-6 space-y-6">{sections.map((section) => <section key={section.title}><h2 className="text-base font-semibold">{section.title}</h2>{section.body.map((paragraph) => <p key={paragraph} className="mt-2 text-sm leading-6 text-white/70">{paragraph}</p>)}</section>)}</div>
      </article>
    </main>
  )
}
