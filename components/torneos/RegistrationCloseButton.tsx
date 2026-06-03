'use client'

import { useRouter } from 'next/navigation'

export function RegistrationCloseButton({ slug }: { slug: string }) {
  const router = useRouter()

  function handleClose() {
    if (window.confirm('¿Seguro que quieres abandonar la inscripción?')) {
      router.push(`/t/${slug}`)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClose}
      aria-label="Cerrar inscripción"
      className="flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="2" y1="2" x2="14" y2="14" />
        <line x1="14" y1="2" x2="2" y2="14" />
      </svg>
    </button>
  )
}
