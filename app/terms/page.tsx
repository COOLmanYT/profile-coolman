import { siteConfig } from '@/lib/site-config.mjs'
import LegalDocument from '@/components/LegalDocument'
import { getLegalSettings } from '@/lib/legal-settings'

export const metadata = { title: `Terms of Service | ${siteConfig.profile.username}` }

export default async function TermsPage() {
  const settings = await getLegalSettings()
  return <LegalDocument kind="terms" defaultSimpleMode={settings.simpleModeDefault} />
}
