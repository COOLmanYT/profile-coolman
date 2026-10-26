'use client'

import { useState } from 'react'
import { siteConfig } from '@/lib/site-config.mjs'
import type { DashboardMember, OAuthProvider } from '@/lib/dashboard-access'
import { useToast } from './ToastProvider'

export default function AccessSettingsClient({ initialMembers }: { initialMembers: DashboardMember[] }) {
  const enabledProviders = (['discord', 'github', 'google'] as const).filter(id => siteConfig.dashboard.auth.providers[id])
  const [members, setMembers] = useState(initialMembers)
  const [provider, setProvider] = useState<OAuthProvider>(enabledProviders[0])
  const [subject, setSubject] = useState('')
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()
  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/dashboard/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(members) })
      if (!response.ok) throw new Error()
      showToast({ variant: 'success', title: 'Dashboard access saved' })
    } catch { showToast({ variant: 'error', title: 'Could not save access' }) }
    finally { setSaving(false) }
  }
  return <section className="rounded-xl border border-white/10 bg-white/5 p-4">
    <h2 className="text-sm font-semibold text-white">Dashboard access</h2>
    <p className="mt-1 text-xs text-white/60">Added accounts can edit site settings. Only the permanent owner can manage access or connect Twitch. Your owner account is kept in the server settings and cannot be removed here.</p>
    <ul className="mt-3 space-y-2">{members.map(member => <li key={`${member.provider}:${member.subject}`} className="flex items-center justify-between gap-2 text-xs text-white/80"><span className="break-all">{member.provider}: {member.subject}{!siteConfig.dashboard.auth.providers[member.provider] && ' (provider disabled)'}</span><button type="button" disabled={saving} onClick={() => setMembers(members.filter(item => item !== member))} className="rounded border border-white/20 px-2 py-1">Remove</button></li>)}</ul>
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={event => {
      event.preventDefault()
      const id = subject.trim()
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || members.length >= 50 || members.some(item => item.provider === provider && item.subject === id)) return
      setMembers([...members, { provider, subject: id }]); setSubject('')
    }}>
      <label className="text-xs text-white/70">Provider<select value={provider} disabled={saving} onChange={event => setProvider(event.target.value as OAuthProvider)} className="mt-1 block rounded bg-[#1a1a1a] p-2 text-white">{enabledProviders.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
      <label className="min-w-0 flex-1 text-xs text-white/70">Provider account ID<input required value={subject} maxLength={128} pattern="[a-zA-Z0-9_-]+" disabled={saving} onChange={event => setSubject(event.target.value)} className="mt-1 block w-full rounded bg-[#1a1a1a] p-2 text-white" /></label>
      <button type="submit" disabled={saving || members.length >= 50} className="self-end rounded border border-white/20 px-3 py-2 text-xs text-white">Add</button>
    </form>
    <p className="mt-2 text-xs text-white/50">Use the provider’s account ID, never a display name or email. Save to apply additions and removals; access is checked on every request.</p>
    <button type="button" disabled={saving} onClick={save} className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : 'Save access'}</button>
  </section>
}
