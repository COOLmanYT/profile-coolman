'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Toast = { id: number; title: string; description?: string; code?: string; variant: 'success' | 'error' }
type ToastInput = Omit<Toast, 'id'>

const ToastContext = createContext<{ showToast: (toast: ToastInput) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const showToast = useCallback((toast: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current.slice(-2), { ...toast, id }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 5000)
  }, [])
  return <ToastContext.Provider value={{ showToast }}>{children}<div aria-live="polite" aria-atomic="true" className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-sm flex-col gap-2"><div className="sr-only">Notifications</div>{toasts.map((toast) => <div key={toast.id} role={toast.variant === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 shadow-2xl backdrop-blur ${toast.variant === 'success' ? 'border-emerald-300/35 bg-emerald-950/90 text-emerald-50' : 'border-red-300/35 bg-red-950/90 text-red-50'}`}><p className="text-sm font-semibold">{toast.variant === 'success' ? '✓ ' : '⚠ '}{toast.title}</p>{toast.description && <p className="mt-0.5 text-xs opacity-80">{toast.description}</p>}{toast.code && <p className="mt-1 text-[10px] font-mono opacity-65">Code: {toast.code}</p>}</div>)}</div></ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export async function responseErrorCode(response: Response) {
  const body = await response.clone().json().catch(() => null) as { error?: unknown } | null
  const code = typeof body?.error === 'string' ? body.error.replace(/[^a-z0-9_-]/gi, '_').toUpperCase() : ''
  return code || `HTTP_${response.status}`
}
