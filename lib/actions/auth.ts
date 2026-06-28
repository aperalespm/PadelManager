'use server'

import { sql } from '@/lib/db'
import { createSession, deleteSession } from '@/lib/auth'
import crypto from 'node:crypto'
import { redirect } from 'next/navigation'

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  try {
    const attempt = crypto.scryptSync(password, salt, 64).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

async function ensureAdminsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

export async function signInAction(email: string, password: string): Promise<{ error?: string }> {
  await ensureAdminsTable()
  const rows = await sql`SELECT id, email, name, password_hash FROM admins WHERE email = ${email} LIMIT 1`
  const admin = rows[0]
  if (!admin || !verifyPassword(password, admin.password_hash as string)) {
    return { error: 'Email o contraseña incorrectos' }
  }
  await createSession({
    id: admin.id as string,
    email: admin.email as string,
    name: (admin.name as string | null) ?? null,
  })
  return {}
}

export async function signUpAction(name: string, email: string, password: string): Promise<{ error?: string }> {
  await ensureAdminsTable()
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }
  const existing = await sql`SELECT id FROM admins WHERE email = ${email} LIMIT 1`
  if (existing[0]) return { error: 'Ya existe una cuenta con este email' }
  const password_hash = hashPassword(password)
  const rows = await sql`
    INSERT INTO admins (email, name, password_hash)
    VALUES (${email}, ${name}, ${password_hash})
    RETURNING id, email, name
  `
  await createSession({
    id: rows[0].id as string,
    email: rows[0].email as string,
    name: (rows[0].name as string | null) ?? null,
  })
  return {}
}

export async function signOutAction(): Promise<void> {
  await deleteSession()
  redirect('/login')
}
