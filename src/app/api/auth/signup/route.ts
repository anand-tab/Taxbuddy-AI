import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name && name.trim()) || cleanEmail.split('@')[0];
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const sql = getDb();

    // Check if user already exists
    const existing = await sql`
      SELECT id FROM users WHERE email = ${cleanEmail} LIMIT 1;
    `;
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists. Please log in.' }, { status: 400 });
    }

    // Insert user into Neon Postgres
    await sql`
      INSERT INTO users (id, email, name, password_hash)
      VALUES (${userId}, ${cleanEmail}, ${cleanName}, ${passwordHash});
    `;

    return NextResponse.json({
      success: true,
      user: { id: userId, email: cleanEmail, name: cleanName },
      profile: null,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Signup API Error:', error);
    return NextResponse.json({ error: error.message || 'Signup failed' }, { status: 500 });
  }
}

