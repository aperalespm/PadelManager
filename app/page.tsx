// This is the root page — redirect to dashboard or login
// Replace this with your actual app entry point
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
