import ColorModeProvider from '@/components/ColorModeProvider'
import { siteConfig } from '@/lib/site-config.mjs'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { redirect } from 'next/navigation'
import './globals.css'
import Providers from './providers'
import VisitorPreferencesProvider from '@/components/VisitorPreferencesProvider'
import { ToastProvider } from '@/components/ToastProvider'
import { privacyBrowserGuard } from '@/lib/privacy-browser.mjs'
import { privacyRuntimeBlocked, PRIVACY_BLOCKED_PATH } from '@/lib/privacy-policy.mjs'

const geist = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || siteConfig.site.url),
  title: siteConfig.profile.username,
  description: siteConfig.profile.bio,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (privacyRuntimeBlocked()) redirect(PRIVACY_BLOCKED_PATH)
  return (
    <html lang={siteConfig.site.language} data-color-mode={siteConfig.appearance.defaultMode === 'light' ? 'light' : 'dark'} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: privacyBrowserGuard(process.env.VERCEL_ENV === 'preview') }} /></head>
      <body className={`${geist.className} bg-black min-h-screen`}>
        <ColorModeProvider><Providers><ToastProvider><VisitorPreferencesProvider>{children}</VisitorPreferencesProvider></ToastProvider></Providers></ColorModeProvider>
      </body>
    </html>
  )
}
