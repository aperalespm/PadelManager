import { BottomNav } from '@/components/layout/BottomNav'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

export const dynamic = 'force-dynamic'

export default function PerfilPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Mi perfil</h1>
      </header>
      <main className="max-w-md mx-auto px-4 py-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sin perfil</EmptyTitle>
            <EmptyDescription>Inicia sesión para ver tu perfil.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
      <BottomNav />
    </div>
  )
}
