'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateGroupBracket } from '@/lib/actions/bracket'
import { Button } from '@/components/ui/button'

interface Props {
  tournamentId: string
}

export function GenerateBracketButton({ tournamentId }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      const result = await generateGroupBracket(tournamentId)
      if (result.error) {
        alert(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? 'Generando...' : 'Generar cuadro'}
    </Button>
  )
}
