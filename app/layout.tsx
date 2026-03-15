import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import Providers from './providers'

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
      <body className={`${geist.className} bg-[#111111] min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
