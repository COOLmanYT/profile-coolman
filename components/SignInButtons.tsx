'use client'

import { signIn } from 'next-auth/react'

export default function SignInButtons({ providers }: { providers: { id: string; name: string }[] }) {
  return <>{providers.map(provider => <button key={provider.id} onClick={() => signIn(provider.id, { callbackUrl: '/dashboard' })} className={`w-full rounded-xl px-6 py-3 font-semibold text-white transition-colors ${provider.id === 'discord' ? 'bg-[#5865F2] hover:bg-[#4752C4]' : 'bg-white/10 hover:bg-white/20'}`}>Sign in with {provider.name}</button>)}{providers.length === 0 && <p className="text-sm text-white/60">No sign-in provider is configured.</p>}</>
}
