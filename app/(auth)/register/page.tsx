'use client'

import { signUpAction } from '@/lib/actions/auth'
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

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    setError('')
    const result = await signUpAction(name, email, password)
    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/torneos')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0d1117]">
      <div className="w-full max-w-sm flex flex-col gap-8">

        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" fill="#3b82f620" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="24" y="31" textAnchor="middle" fontSize="22" fill="#3b82f6">🎾</text>
          </svg>
          <div className="text-center">
            <h1 className="text-[32px] font-extrabold text-white tracking-[-0.5px]">JoyPadel</h1>
            <p className="text-[15px] text-[#8b949e] mt-1">Crea tu cuenta</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-semibold text-white">Nombre</label>
            <input
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl bg-[#161b22] border border-[#30363d] text-white placeholder:text-[#8b949e] text-[15px] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f620] transition-all"
            />
          </div>

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
            <label className="text-[14px] font-semibold text-white">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3.5 pr-12 rounded-xl bg-[#161b22] border border-[#30363d] text-white placeholder:text-[#8b949e] text-[15px] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f620] transition-all"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white transition-colors">
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-semibold text-white">Confirmar contraseña</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full px-4 py-3.5 pr-12 rounded-xl bg-[#161b22] border border-[#30363d] text-white placeholder:text-[#8b949e] text-[15px] outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f620] transition-all"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-white transition-colors">
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-[#f85149] bg-[#f8514910] border border-[#f8514930] rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-[15px] transition-colors disabled:opacity-60 mt-1"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-[14px] text-[#8b949e] text-center">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-[#3b82f6] font-semibold hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}
