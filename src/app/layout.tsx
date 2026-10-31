import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaxBuddy — Next-Gen AI Tax Advisory for India',
  description: 'AI-guided Indian tax filing advisory, Form 16 extraction, and Old vs New regime calculator.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#090d16] text-slate-100 selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
