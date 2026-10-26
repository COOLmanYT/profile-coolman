import { authOptions } from '@/lib/auth'
import SignInButtons from '@/components/SignInButtons'

export default function SignIn() {
  const providers = authOptions.providers.map(provider => ({ id: provider.id, name: provider.name }))
  return <div className="flex min-h-screen items-center justify-center bg-[#1a1a1a] p-4">
    <div className="flex w-80 flex-col items-center gap-6 rounded-2xl bg-[#2a2a2a] p-8 shadow-2xl">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      <p className="text-center text-sm text-white/60">Sign in to access the dashboard</p>
      <SignInButtons providers={providers} />
    </div>
  </div>
}
