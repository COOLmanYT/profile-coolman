import ColorModeProvider from '@/components/ColorModeProvider'
import { siteConfig } from '@/lib/site-config.mjs'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Providers from './providers'
import VisitorPreferencesProvider from '@/components/VisitorPreferencesProvider'
import { ToastProvider } from '@/components/ToastProvider'

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
  return (
    <html lang={siteConfig.site.language} data-color-mode={siteConfig.appearance.defaultMode === 'light' ? 'light' : 'dark'} suppressHydrationWarning>
      <body className={`${geist.className} bg-black min-h-screen`}>
        <ColorModeProvider><Providers><ToastProvider><VisitorPreferencesProvider>{children}</VisitorPreferencesProvider></ToastProvider></Providers></ColorModeProvider>
      </body>
    </html>
  )
}
