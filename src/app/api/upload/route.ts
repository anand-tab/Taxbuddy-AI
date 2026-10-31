import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getDb } from '@/lib/db';
import {
  calculateOldRegimeTax,
  calculateNewRegimeTax,
  compareRegimes,
  Deductions,
  SalaryBreakdown,
} from '@/lib/tax-engine';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = (formData.get('userId') as string) || 'guest_user';
    const userEmail = (formData.get('userEmail') as string) || 'guest@taxbuddy.local';
    const userName = (formData.get('userName') as string) || 'Guest User';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    // Convert file to base64
    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const mimeType = file.type || 'application/pdf';

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are an expert Indian Income Tax Form 16 and Salary Payslip OCR and data extraction system.
Analyze the provided document (Form 16 Part A/B or Salary Payslip) and extract all financial figures accurately.

Output ONLY a raw, valid JSON object (no markdown, no backticks, no extra text) with the following exact keys:
{
  "documentType": "FORM_16" or "PAYSLIP",
  "employerName": string or null,
  "pan": string or null,
  "assessmentYear": string or null,
  "grossSalary": number (Gross salary under section 17(1) or annualized CTC/gross),
  "basicSalary": number (Basic pay; if not explicitly broken down, estimate 50% of gross),
  "hraReceived": number (House Rent Allowance received from employer),
  "standardDeduction": number (usually 50000 or 75000),
  "section80C": number (Total under 80C like EPF, PPF, ELSS, Life insurance),
  "section80D": number (Health Insurance premium),
  "section80CCD1B": number (NPS employee contribution up to 50k),
  "homeLoanInterest": number (Section 24(b)),
  "totalTdsDeducted": number (Tax deducted at source by employer),
  "notes": string (Brief summary of key deductions found)
}

Important:
- Return strictly numbers for numeric values, not strings (e.g. 1200000, not "12,00,000").
- If a value is missing or not applicable, default to 0.
`;

    const extractionResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
    });

    let rawText = extractionResponse.text?.trim() || '{}';
    // Clean markdown code blocks if returned
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`Failed to parse extracted JSON: ${rawText.slice(0, 100)}...`);
    }

    // Run tax engine calculations
    const grossSalary = Number(parsed.grossSalary) || 0;
    const basicSalary = Number(parsed.basicSalary) || Math.round(grossSalary * 0.5);
    const hraReceived = Number(parsed.hraReceived) || Math.round(grossSalary * 0.25);
    const rentPaid = 0; // Default rent paid, can be updated by user in chat/profile

    const deductions: Deductions = {
      section80C: Number(parsed.section80C) || 0,
      section80D: Number(parsed.section80D) || 0,
      section80CCD1B: Number(parsed.section80CCD1B) || 0,
      section80E: 0,
      section80G: 0,
      section80TTA: 0,
      homeLoanInterest: Number(parsed.homeLoanInterest) || 0,
      rentPaid: rentPaid,
      isMetroCity: true,
    };

    const salaryBreakdown: SalaryBreakdown = {
      basic: basicSalary,
      hra: hraReceived,
      da: 0,
      specialAllowance: Math.max(0, grossSalary - basicSalary - hraReceived),
      lta: 0,
      otherAllowances: 0,
    };

    const comparison = compareRegimes(grossSalary, deductions, salaryBreakdown, 'below60');

    // Store in Neon Database
    const sql = getDb();
    
    // Ensure user exists
    await sql`
      INSERT INTO users (id, email, name)
      VALUES (${userId}, ${userEmail}, ${userName})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;
    `;

    const profileId = `prof_${Date.now()}`;
    await sql`
      INSERT INTO tax_profiles (
        id, user_id, financial_year, assessment_year, employer_name, pan,
        gross_salary, basic_salary, hra_received, rent_paid, is_metro,
        section_80c, section_80d, section_80ccd1b, home_loan_interest,
        total_tds_deducted, recommended_regime, old_regime_tax, new_regime_tax,
        tax_savings, raw_extracted_data
      ) VALUES (
        ${profileId}, ${userId}, '2025-2026', '2026-2027',
        ${parsed.employerName || 'Employer'}, ${parsed.pan || null},
        ${grossSalary}, ${basicSalary}, ${hraReceived}, ${rentPaid}, true,
        ${deductions.section80C}, ${deductions.section80D}, ${deductions.section80CCD1B},
        ${deductions.homeLoanInterest}, ${Number(parsed.totalTdsDeducted) || 0},
        ${comparison.recommendation}, ${comparison.oldRegime.totalTax},
        ${comparison.newRegime.totalTax}, ${comparison.savings},
        ${JSON.stringify(parsed)}
      );
    `;

    return NextResponse.json({
      success: true,
      profileId,
      extracted: parsed,
      comparison,
      tds: Number(parsed.totalTdsDeducted) || 0,
      taxBalance: {
        tdsDeducted: Number(parsed.totalTdsDeducted) || 0,
        bestRegimeTax:
          comparison.recommendation === 'new'
            ? comparison.newRegime.totalTax
            : comparison.oldRegime.totalTax,
        netPayableOrRefund:
          (Number(parsed.totalTdsDeducted) || 0) -
          (comparison.recommendation === 'new'
            ? comparison.newRegime.totalTax
            : comparison.oldRegime.totalTax),
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 });
  }
}

