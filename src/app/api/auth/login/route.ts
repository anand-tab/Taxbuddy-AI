import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const sql = getDb();

    // Query user by email
    const users = await sql`
      SELECT id, email, name, password_hash
      FROM users
      WHERE email = ${cleanEmail}
      LIMIT 1;
    `;

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'No account found with this email. Please sign up.' }, { status: 404 });
    }

    const user = users[0];

    // If user has a password set, verify it
    if (user.password_hash) {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return NextResponse.json({ error: 'Incorrect password. Please try again.' }, { status: 401 });
      }
    }

    // Fetch user tax profile from Neon
    const profileRows = await sql`
      SELECT * FROM tax_profiles
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      profile: profileRows && profileRows.length > 0 ? profileRows[0] : null,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Login API Error:', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
