'use client'

import { authClient } from '@/lib/auth-client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: err } = await authClient.signIn.email({ email, password })
      if (err) {
        setError('Email o contraseña incorrectos')
      } else {
        router.push('/admin')
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0d1117]">
      <div className="w-full max-w-sm flex flex-col gap-8">

        <div className="flex flex-col items-center gap-3">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" fill="#3b82f620" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="24" y="31" textAnchor="middle" fontSize="22" fill="#3b82f6">🎾</text>
          </svg>
          <div className="text-center">
            <h1 className="text-[32px] font-extrabold text-white tracking-[-0.5px]">JoyPadel</h1>
            <p className="text-[15px] text-[#8b949e] mt-1">Inicia sesión en tu cuenta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-semibold text-white">Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl bg-[#161b22] border border-[#30363d] text-white placeholder:text-[#8b949e] text-[15px] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f620] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[14px] font-semibold text-white">Contraseña</label>
              <Link href="/forgot-password" className="text-[13px] text-[#3b82f6] hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 pr-12 rounded-xl bg-[#161b22] border border-[#30363d] text-white placeholder:text-[#8b949e] text-[15px] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f620] transition-all"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white transition-colors">
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-[#f85149] bg-[#f8514910] border border-[#f8514930] rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-[15px] transition-colors disabled:opacity-60 mt-1">
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-[14px] text-[#8b949e] text-center">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="text-[#3b82f6] font-semibold hover:underline">Regístrate</Link>
        </p>
      </div>
    </div>
  )
}
