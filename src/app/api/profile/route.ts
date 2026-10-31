import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'guest_user';

    const sql = getDb();
    const rows = await sql`
      SELECT * FROM tax_profiles 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC 
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({ profile: rows[0] });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

