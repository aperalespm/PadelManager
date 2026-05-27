import { auth } from '@/lib/auth'

export default async function DashboardPage() {
  const session = await auth.getSession()
  const user = session?.data?.user

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Hola, {user?.name ?? user?.email ?? 'usuario'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tu dashboard
        </p>
        {/* Add your dashboard content here */}
      </div>
    </main>
  )
}
