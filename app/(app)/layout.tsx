import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.getSession()
  if (!session?.data) redirect('/login')

  return <>{children}</>
}
