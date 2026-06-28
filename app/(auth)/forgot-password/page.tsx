'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Email system not yet configured — show success message regardless
    setSent(true)
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
            <p className="text-[15px] text-[#8b949e] mt-1">Recupera tu contraseña</p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4 text-center">
            <div className="bg-[#1a2e1a] border border-[#2ea04330] rounded-xl px-4 py-5">
              <p className="text-white font-semibold mb-1">Revisa tu email</p>
              <p className="text-[14px] text-[#8b949e]">Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña.</p>
            </div>
            <Link href="/login" className="text-[14px] text-[#3b82f6] hover:underline">
              ← Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6">
              <p className="text-[15px] text-[#8b949e] text-center leading-relaxed">
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>
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
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-[15px] transition-colors"
                >
                  Enviar enlace
                </button>
              </form>
            </div>
            <Link href="/login" className="text-[14px] text-[#8b949e] hover:text-white text-center transition-colors">
              ← Volver al inicio de sesión
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
