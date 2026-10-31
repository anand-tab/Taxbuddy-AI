import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';
import { getDb } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_gemini_api_key_here')) {
      return NextResponse.json({
        reply: "⚠️ GEMINI_API_KEY is not configured yet. Please check your `.env.local`.",
      });
    }

    // Try fetching user profile from Neon DB for hyper-personalised context
    let profileContext = '';
    try {
      const sql = getDb();
      const currentUserId = userId || 'guest_user';
      const rows = await sql`
        SELECT * FROM tax_profiles 
        WHERE user_id = ${currentUserId} 
        ORDER BY created_at DESC 
        LIMIT 1;
      `;
      if (rows && rows.length > 0) {
        const p = rows[0];
        profileContext = `
USER'S SAVED TAX DOSSIER (FROM UPLOADED FORM 16 / PAYSLIP):
- Employer: ${p.employer_name || 'N/A'}
- Financial Year: ${p.financial_year || '2025-2026'}
- Gross Salary: ₹${Number(p.gross_salary || 0).toLocaleString('en-IN')}
- Basic Salary: ₹${Number(p.basic_salary || 0).toLocaleString('en-IN')}
- HRA Received: ₹${Number(p.hra_received || 0).toLocaleString('en-IN')}
- Section 80C Claimed: ₹${Number(p.section_80c || 0).toLocaleString('en-IN')}
- Section 80D Claimed: ₹${Number(p.section_80d || 0).toLocaleString('en-IN')}
- Section 80CCD(1B) NPS: ₹${Number(p.section_80ccd1b || 0).toLocaleString('en-IN')}
- Total TDS Deducted: ₹${Number(p.total_tds_deducted || 0).toLocaleString('en-IN')}
- Currently Recommended Regime: ${p.recommended_regime}
- Estimated Tax under Best Regime: ₹${Number(p.recommended_regime === 'new' ? p.new_regime_tax : p.old_regime_tax).toLocaleString('en-IN')}

Use this profile data to provide deeply personalised, mathematically precise advice whenever relevant.
`;
      }
    } catch (dbErr) {
      console.warn('Could not fetch DB profile for chat context:', dbErr);
    }

    const ai = new GoogleGenAI({ apiKey });

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const enrichedSystemInstruction = profileContext
      ? `${SYSTEM_PROMPT}\n\n${profileContext}`
      : SYSTEM_PROMPT;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: enrichedSystemInstruction,
        temperature: 0.4,
      },
    });

    const reply = response.text || "I couldn't process that. Please try rephrasing your details.";
    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { reply: `Encountered an issue with the AI service: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
