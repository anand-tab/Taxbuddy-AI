'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Upload,
  Sliders,
  User as UserIcon,
  LogOut,
  Send,
  FileText,
  ShieldCheck,
  TrendingUp,
  X,
  Lock,
  Mail,
  Zap,
  ArrowRight,
  ShieldAlert,
  Coins,
  CheckCircle2
} from 'lucide-react';
import {
  compareRegimes,
  formatCurrency,
  RegimeComparison,
  Deductions,
  SalaryBreakdown,
} from '@/lib/tax-engine';

interface User {
  id: string;
  name: string;
  email: string;
}

interface TaxProfile {
  employer_name?: string;
  gross_salary: number;
  basic_salary: number;
  hra_received: number;
  section_80c: number;
  section_80d: number;
  section_80ccd1b: number;
  home_loan_interest?: number;
  total_tds_deducted: number;
  recommended_regime: 'new' | 'old';
  old_regime_tax: number;
  new_regime_tax: number;
  tax_savings: number;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  comparison?: RegimeComparison;
}

export default function Home() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard / Profile state
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState<boolean>(false);

  // Chat states
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "👋 **Namaste! I am TaxBuddy**, your personal AI tax advisor for **FY 2025-26**.\n\nYou can ask me tax questions, simulate rent & 80C deductions, or **upload your Form 16 / Payslip** to let AI extract and track everything!",
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sliders Drawer State
  const [showQuickCalc, setShowQuickCalc] = useState(false);
  const [quickSalary, setQuickSalary] = useState<number>(1200000);
  const [quickRent, setQuickRent] = useState<number>(180000);
  const [quick80C, setQuick80C] = useState<number>(150000);
  const [quick80D, setQuick80D] = useState<number>(25000);
  const [quickNPS, setQuickNPS] = useState<number>(50000);
  const [quickMetro, setQuickMetro] = useState<boolean>(true);
  const [instantResult, setInstantResult] = useState<RegimeComparison | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-restore session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('taxbuddy_user');
      if (saved) {
        const u = JSON.parse(saved);
        setUser(u);
        fetchProfile(u.id);
      }
    } catch {
      // ignore
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (user) {
      scrollToBottom();
    }
  }, [messages, loading, user]);

  const fetchProfile = async (uid: string) => {
    try {
      const res = await fetch(`/api/profile?userId=${uid}`);
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.warn('Failed to fetch profile', err);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        authMode === 'signup'
          ? { name: authName, email: authEmail, password: authPassword }
          : { email: authEmail, password: authPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Authentication failed');
      }

      setUser(data.user);
      localStorage.setItem('taxbuddy_user', JSON.stringify(data.user));

      if (data.profile) {
        setProfile(data.profile);
      }

      setAuthPassword('');

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `⚡ **Welcome, ${data.user.name}!** You are signed in.\n\n${
            data.profile
              ? `Your stored tax dossier from **${data.profile.employer_name || 'your employer'}** is loaded (Gross: ${formatCurrency(
                  data.profile.gross_salary
                )}). Ask me any question or upload a new payslip!`
              : 'You have no tax dossier on record yet. Click **"Upload Form 16 / Payslip"** in the top bar to let Multimodal AI extract your figures automatically!'
          }`,
        },
      ]);
    } catch (err: unknown) {
      const error = err as Error;
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('taxbuddy_user');
    setUser(null);
    setProfile(null);
    setShowProfileDrawer(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', user.id);
    formData.append('userName', user.name);
    formData.append('userEmail', user.email);

    const uploadNotice: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `📄 **Uploading & parsing "${file.name}"...**\n\nMultimodal Vision AI is scanning employer TAN, Gross Salary, TDS, and 80C/80D line-items...`,
    };
    setMessages((prev) => [...prev, uploadNotice]);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to process document');
      }

      setProfile({
        employer_name: data.extracted.employerName || 'Employer',
        gross_salary: data.extracted.grossSalary,
        basic_salary: data.extracted.basicSalary,
        hra_received: data.extracted.hraReceived,
        section_80c: data.extracted.section80C,
        section_80d: data.extracted.section80D,
        section_80ccd1b: data.extracted.section80CCD1B,
        home_loan_interest: data.extracted.homeLoanInterest,
        total_tds_deducted: data.tds,
        recommended_regime: data.comparison.recommendation,
        old_regime_tax: data.comparison.oldRegime.totalTax,
        new_regime_tax: data.comparison.newRegime.totalTax,
        tax_savings: data.comparison.savings,
      });

      const refundOrPayable = data.taxBalance.netPayableOrRefund;
      const statusText =
        refundOrPayable >= 0
          ? `🎉 **Expected Tax Refund:** ${formatCurrency(refundOrPayable)} (TDS deducted by employer: ${formatCurrency(
              data.tds
            )}, Best regime tax: ${formatCurrency(data.taxBalance.bestRegimeTax)})`
          : `⚠️ **Remaining Tax to Pay:** ${formatCurrency(
              Math.abs(refundOrPayable)
            )} (Best regime tax: ${formatCurrency(data.taxBalance.bestRegimeTax)}, TDS deducted: ${formatCurrency(
              data.tds
            )})`;

      const resultMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `✅ **Form 16 / Payslip analyzed & saved to your Neon DB account!**\n\n- **Employer:** ${
          data.extracted.employerName || 'Extracted from file'
        }\n- **Gross Salary:** ${formatCurrency(data.extracted.grossSalary)}\n- **TDS Deducted:** ${formatCurrency(
          data.tds
        )}\n- **Optimal Choice:** **${data.comparison.recommendation.toUpperCase()} REGIME**\n\n${statusText}\n\n*Click your profile in the top bar to inspect your full dossier!*`,
        comparison: data.comparison,
      };

      setMessages((prev) => [...prev, resultMsg]);
    } catch (err: unknown) {
      const error = err as Error;
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ **Document extraction error:** ${error.message}. Please try again with a clean PDF or image.`,
        },
      ]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !user) return;

    const userText = input.trim();
    setInput('');
    const newMsg: Message = { id: Date.now().toString(), role: 'user', content: userText };
    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);

    try {
      const history = [...messages, newMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userId: user.id }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.reply || 'Calculation complete.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Unable to reach the AI engine. Please verify your connection or try the sliders tool.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Run quick slider tool
  const runQuickCalculation = () => {
    const deductions: Deductions = {
      section80C: quick80C,
      section80D: quick80D,
      section80CCD1B: quickNPS,
      section80E: 0,
      section80G: 0,
      section80TTA: 0,
      homeLoanInterest: 0,
      rentPaid: quickRent,
      isMetroCity: quickMetro,
    };

    const salaryBreakdown: SalaryBreakdown = {
      basic: Math.round(quickSalary * 0.5),
      hra: Math.round(quickSalary * 0.25),
      da: 0,
      specialAllowance: Math.round(quickSalary * 0.25),
      lta: 0,
      otherAllowances: 0,
    };

    const res = compareRegimes(quickSalary, deductions, salaryBreakdown, 'below60');
    setInstantResult(res);

    const compMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Here is the instant calculation for **${formatCurrency(quickSalary)}**:`,
      comparison: res,
    };
    setMessages((prev) => [...prev, compMsg]);
  };

  // Wait until localStorage check is done
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#090d16] text-white">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm text-slate-400 font-mono">Initializing TaxBuddy...</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // LANDING PAGE: AUTH (LOGIN / SIGNUP) WHEN NOT SIGNED IN
  // -------------------------------------------------------------------------
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-[#090d16] text-slate-100 font-sans relative overflow-x-hidden selection:bg-emerald-500 selection:text-black">
        {/* Ambient Neon Background Glows */}
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />

        {/* Top Minimal Brand Bar */}
        <header className="flex items-center justify-between border-b border-slate-800/80 bg-[#0d121f]/90 backdrop-blur-md px-6 py-4 z-20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-black text-xl shadow-lg shadow-emerald-500/30">
              ₹
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                TaxBuddy <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-extrabold text-xs">AI</span>
              </h1>
              <p className="text-[11px] text-slate-400">Autonomous Tax Advisory & Filing Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2.5 py-1 rounded-full font-mono font-medium">
              FY 2025-26 Ready
            </span>
          </div>
        </header>

        {/* Main Hero & Auth Split Layout */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl w-full items-center">
            {/* Left Value Prop Hero */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1.5 rounded-full text-xs text-emerald-300 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span>Next-Gen Indian Tax Optimization</span>
              </div>

              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
                Clear all tax confusion in <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-teal-500 bg-clip-text text-transparent">30 seconds</span>.
              </h2>

              <p className="text-sm md:text-base text-slate-400 leading-relaxed max-w-xl">
                Upload your <strong>Form 16 or Monthly Payslip</strong>. Our multimodal AI reads your line-items, tells you whether the <strong>Old or New Tax Regime</strong> saves more money, and reveals how much refund you'll get from the Income Tax department.
              </p>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-[#0d121f]/90 border border-slate-800/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-md">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">Instant Form 16 OCR</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Extracts salary & TDS with zero manual typing.</p>
                  </div>
                </div>

                <div className="bg-[#0d121f]/90 border border-slate-800/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-md">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">Regime Verdict</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Exact rupee-for-rupee comparison & savings.</p>
                  </div>
                </div>

                <div className="bg-[#0d121f]/90 border border-slate-800/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-md">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">Private & Serverless</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Backed by Neon Serverless PostgreSQL.</p>
                  </div>
                </div>

                <div className="bg-[#0d121f]/90 border border-slate-800/80 rounded-2xl p-3.5 flex items-start gap-3 shadow-md">
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs">Legal Tax Cuts</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">80C, 80D, HRA & NPS optimization tips.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Landing Auth Card */}
            <div className="lg:col-span-5">
              <div className="bg-[#0d121f]/95 rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-800 relative overflow-hidden backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-black text-white text-xl">
                      {authMode === 'login' ? 'Welcome Back' : 'Create Tax Account'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Sign in to unlock your personalised tax co-pilot</p>
                  </div>
                </div>

                {/* Switcher Tab */}
                <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl mb-5 border border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      authMode === 'login'
                        ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthError('');
                    }}
                    className={`py-2 rounded-lg transition-all ${
                      authMode === 'signup'
                        ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                {authError && (
                  <div className="bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Your Full Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="e.g. Suman Anand"
                          className="w-full text-xs rounded-xl border border-slate-700/80 bg-[#121829] pl-9 pr-3 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="e.g. suman@example.com"
                        className="w-full text-xs rounded-xl border border-slate-700/80 bg-[#121829] pl-9 pr-3 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full text-xs rounded-xl border border-slate-700/80 bg-[#121829] pl-9 pr-3 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                    </div>
                    {authMode === 'signup' && (
                      <p className="text-[10px] text-slate-500 mt-1">Minimum 6 characters</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-extrabold text-xs py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                  >
                    <span>
                      {authLoading
                        ? 'Verifying with Neon DB...'
                        : authMode === 'login'
                        ? 'Sign In to Dashboard'
                        : 'Create Free Account'}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // AUTHENTICATED APP DASHBOARD
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col bg-[#090d16] text-slate-100 font-sans relative overflow-hidden">
      {/* Background ambient neon glow effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Top Futuristic Header */}
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-[#0d121f]/90 backdrop-blur-md px-5 py-3.5 z-20 shadow-lg shadow-black/40">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-extrabold shadow-md shadow-emerald-500/30">
            <span className="text-xl">₹</span>
            <div className="absolute inset-0 rounded-xl border border-white/20 pointer-events-none" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                TaxBuddy <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-extrabold text-xs">AI</span>
              </h1>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                FY 2025-26
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Autonomous Tax Optimization & Filing Co-pilot</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-2 text-xs font-semibold text-black shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" />
            <span>{uploading ? 'Parsing with AI...' : 'Upload Form 16 / Payslip'}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
          />

          {/* Quick Sliders Toggle */}
          <button
            onClick={() => setShowQuickCalc(!showQuickCalc)}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-700/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors"
          >
            <Sliders className="h-3.5 w-3.5 text-emerald-400" />
            <span>{showQuickCalc ? 'Hide Sliders' : 'Quick Sliders'}</span>
          </button>

          {/* User Sign In / Profile Button */}
          <button
            onClick={() => setShowProfileDrawer(true)}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 px-3.5 py-2 text-xs font-medium text-emerald-300 transition-all"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="max-w-[120px] truncate font-semibold">{user.name}</span>
            {profile && (
              <span className="hidden md:inline bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                Dossier Active
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Chat Feed */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl ${
                  m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl text-xs font-semibold shadow-md ${
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-slate-600 to-slate-800 text-white border border-slate-600'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-700 text-black font-bold shadow-emerald-500/20'
                  }`}
                >
                  {m.role === 'user' ? <UserIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-black" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-900/30'
                      : 'bg-[#121829] border border-slate-800 text-slate-200 shadow-black/40'
                  }`}
                >
                  {m.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <div className="space-y-2 prose-sm max-w-none text-slate-200">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => (
                            <h2 className="text-base font-bold text-white mt-2 mb-1 flex items-center gap-1.5">
                              <span className="text-emerald-400">#</span> {children}
                            </h2>
                          ),
                          h2: ({ children }) => (
                            <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>
                          ),
                          h3: ({ children }) => (
                            <h4 className="text-xs font-semibold text-emerald-400 mt-1 mb-1">{children}</h4>
                          ),
                          p: ({ children }) => <p className="mb-2 leading-relaxed text-slate-300">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-slate-300">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-slate-300">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          strong: ({ children }) => (
                            <strong className="font-semibold text-emerald-300">{children}</strong>
                          ),
                          table: ({ children }) => (
                            <div className="my-3 overflow-x-auto rounded-xl border border-slate-800 bg-[#0d121f] shadow-inner">
                              <table className="min-w-full divide-y divide-slate-800 text-xs">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-slate-900/80 text-emerald-400 font-semibold">{children}</thead>
                          ),
                          th: ({ children }) => (
                            <th className="px-3 py-2 text-left font-semibold text-emerald-400">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="px-3 py-2 text-slate-300 border-t border-slate-800/80">{children}</td>
                          ),
                          code: ({ children }) => (
                            <code className="rounded bg-slate-900 border border-slate-700/60 px-1.5 py-0.5 text-xs font-mono text-emerald-300">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Render Visual Comparison Cards */}
                  {m.comparison && (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-[#0a0f1d] p-3.5 space-y-3 shadow-inner">
                      <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
                        {/* New Regime Card */}
                        <div
                          className={`p-3 rounded-xl border transition-all ${
                            m.comparison.recommendation === 'new'
                              ? 'border-emerald-500/80 bg-emerald-950/30 shadow-lg shadow-emerald-950/50'
                              : 'border-slate-800 bg-[#121829]'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-semibold text-slate-300">New Regime</span>
                            {m.comparison.recommendation === 'new' && (
                              <span className="bg-emerald-500 text-black text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide">
                                WINNER
                              </span>
                            )}
                          </div>
                          <div className="text-lg font-bold text-white tracking-tight">
                            {formatCurrency(m.comparison.newRegime.totalTax)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Std Deduction: {formatCurrency(m.comparison.newRegime.standardDeduction)}
                          </div>
                        </div>

                        {/* Old Regime Card */}
                        <div
                          className={`p-3 rounded-xl border transition-all ${
                            m.comparison.recommendation === 'old'
                              ? 'border-emerald-500/80 bg-emerald-950/30 shadow-lg shadow-emerald-950/50'
                              : 'border-slate-800 bg-[#121829]'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-semibold text-slate-300">Old Regime</span>
                            {m.comparison.recommendation === 'old' && (
                              <span className="bg-emerald-500 text-black text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide">
                                WINNER
                              </span>
                            )}
                          </div>
                          <div className="text-lg font-bold text-white tracking-tight">
                            {formatCurrency(m.comparison.oldRegime.totalTax)}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Deductions: {formatCurrency(m.comparison.oldRegime.totalDeductions)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#121829] p-3 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-emerald-400">AI Advice:</strong> {m.comparison.explanation}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(loading || uploading) && (
              <div className="flex gap-3 mr-auto max-w-3xl">
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-black text-xs font-bold shadow-lg shadow-emerald-500/20">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="bg-[#121829] border border-slate-800 rounded-2xl px-4 py-3 text-sm shadow-md flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse delay-100" />
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse delay-200" />
                  <span className="text-xs text-slate-400 ml-1">
                    {uploading ? 'Vision AI is reading document line-items...' : 'Tax engine running...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Futuristic Floating Input Bar */}
          <div className="border-t border-slate-800/80 bg-[#0d121f]/90 backdrop-blur-md p-3 md:p-4">
            <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask e.g. 'I make 18 Lakhs and pay 30k rent in Bangalore, which regime saves more?'"
                  className="w-full rounded-xl border border-slate-700/80 bg-[#121829] px-4 py-3 text-sm text-white placeholder-slate-500 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-40 transition-all active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Quick Calculator Sliders Side Panel */}
        {showQuickCalc && (
          <div className="w-80 md:w-96 border-l border-slate-800 bg-[#0d121f] p-5 overflow-y-auto space-y-4 shrink-0 shadow-2xl z-20">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-400" />
                <h2 className="font-bold text-white text-sm">Interactive Tax Sliders</h2>
              </div>
              <button
                onClick={() => setShowQuickCalc(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between font-medium text-slate-300 mb-1">
                  <span>Annual Salary:</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatCurrency(quickSalary)}</span>
                </div>
                <input
                  type="range"
                  min={300000}
                  max={5000000}
                  step={50000}
                  value={quickSalary}
                  onChange={(e) => setQuickSalary(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-300 mb-1">
                  <span>Annual Rent Paid:</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatCurrency(quickRent)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1200000}
                  step={20000}
                  value={quickRent}
                  onChange={(e) => setQuickRent(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-300 mb-1">
                  <span>Section 80C:</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatCurrency(quick80C)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={150000}
                  step={10000}
                  value={quick80C}
                  onChange={(e) => setQuick80C(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-300 mb-1">
                  <span>Section 80D (Health):</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatCurrency(quick80D)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={75000}
                  step={5000}
                  value={quick80D}
                  onChange={(e) => setQuick80D(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between font-medium text-slate-300 mb-1">
                  <span>NPS 80CCD(1B):</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatCurrency(quickNPS)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50000}
                  step={5000}
                  value={quickNPS}
                  onChange={(e) => setQuickNPS(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="metro-dark"
                  checked={quickMetro}
                  onChange={(e) => setQuickMetro(e.target.checked)}
                  className="accent-emerald-500 rounded"
                />
                <label htmlFor="metro-dark" className="text-slate-400">
                  Metro City (Delhi, Mumbai, Kolkata, Chennai)
                </label>
              </div>

              <button
                onClick={runQuickCalculation}
                className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20"
              >
                Compute & Inject to Chat
              </button>

              {instantResult && (
                <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-1.5">
                  <div className="font-extrabold text-emerald-300">
                    {instantResult.recommendation.toUpperCase()} REGIME SAVES MORE
                  </div>
                  <div className="text-slate-200">
                    Savings: <strong className="text-emerald-400">{formatCurrency(instantResult.savings)}</strong>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-emerald-800/40">
                    New: {formatCurrency(instantResult.newRegime.totalTax)} vs Old:{' '}
                    {formatCurrency(instantResult.oldRegime.totalTax)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Dossier Drawer */}
        {showProfileDrawer && user && (
          <div className="absolute inset-y-0 right-0 w-80 md:w-96 bg-[#0d121f] border-l border-slate-800 shadow-2xl p-6 z-30 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-white text-base">{user.name}</h3>
                <p className="text-xs text-slate-400 font-mono">{user.email}</p>
              </div>
              <button
                onClick={() => setShowProfileDrawer(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {profile ? (
                <>
                  {/* Verdict Header Card */}
                  <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-lg shadow-emerald-950/40">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                      Recommended Strategy
                    </span>
                    <div className="text-xl font-extrabold text-white mt-0.5 tracking-tight">
                      {profile.recommended_regime?.toUpperCase() || 'NEW'} REGIME
                    </div>
                    <div className="text-emerald-300 text-xs mt-1">
                      Saves you {formatCurrency(profile.tax_savings || 0)} compared to the alternative.
                    </div>
                  </div>

                  {/* Income Breakdown */}
                  <div className="border border-slate-800 rounded-2xl p-4 space-y-2.5 bg-[#121829]">
                    <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Extracted Salary</span>
                    </h4>
                    <div className="flex justify-between text-slate-400">
                      <span>Employer:</span>
                      <span className="font-medium text-white">{profile.employer_name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Gross Salary:</span>
                      <span className="font-medium text-white font-mono">{formatCurrency(profile.gross_salary || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Basic Pay:</span>
                      <span className="font-medium text-white font-mono">{formatCurrency(profile.basic_salary || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>HRA Received:</span>
                      <span className="font-medium text-white font-mono">{formatCurrency(profile.hra_received || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800">
                      <span className="font-semibold text-slate-200">Total TDS Paid:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {formatCurrency(profile.total_tds_deducted || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Deductions Breakdown */}
                  <div className="border border-slate-800 rounded-2xl p-4 space-y-2 bg-[#121829]">
                    <h4 className="font-semibold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Deductions on Record</span>
                    </h4>
                    <div className="flex justify-between text-slate-400">
                      <span>Section 80C:</span>
                      <span className="font-medium text-white font-mono">{formatCurrency(profile.section_80c || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Section 80D (Health):</span>
                      <span className="font-medium text-white font-mono">{formatCurrency(profile.section_80d || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>NPS 80CCD(1B):</span>
                      <span className="font-medium text-white font-mono">{formatCurrency(profile.section_80ccd1b || 0)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-[#121829] border border-slate-800 rounded-2xl p-5 text-center space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">No Tax Dossier Yet</h4>
                    <p className="text-slate-400 text-xs mt-1">
                      Upload your Form 16 or Payslip to populate your complete tax profile.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowProfileDrawer(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded-xl text-xs transition-colors"
                  >
                    Upload Document Now
                  </button>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="w-full mt-4 py-2.5 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-800/60 rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
