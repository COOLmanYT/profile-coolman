import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Providers from './providers'
import { Analytics } from '@vercel/analytics/next'
import VisitorPreferencesProvider from '@/components/VisitorPreferencesProvider'

const geist = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
})

export const metadata: Metadata = {
  title: 'COOLman',
  description: 'just a cool dude making content',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-black min-h-screen`}>
        <Providers><VisitorPreferencesProvider>{children}</VisitorPreferencesProvider></Providers>
        <Analytics />
      </body>
    </html>
  )
}
