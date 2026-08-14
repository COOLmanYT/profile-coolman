import LegalDocument from '@/components/LegalDocument'
import { getLegalSettings } from '@/lib/legal-settings'

export const metadata = { title: 'Privacy Policy | COOLman' }

export default async function PrivacyPage() {
  const settings = await getLegalSettings()
  return <LegalDocument kind="privacy" defaultSimpleMode={settings.simpleModeDefault} />
}
