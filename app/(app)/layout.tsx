import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession()
  if (!session?.user) redirect('/login')
  return <>{children}</>
}
