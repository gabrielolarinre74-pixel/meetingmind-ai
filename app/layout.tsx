import type { Metadata } from 'next';
import { JetBrains_Mono, Manrope } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './globals.css';

const sans = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

const title = 'MeetingMind · Meeting notes that turn into next steps';
const description =
  'Record, upload or paste a meeting and get a summary, decisions, owned action items with real dates, a follow-up email and a calendar file. Runs in your browser.';

export const metadata: Metadata = {
  title,
  description,
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.svg` },
  openGraph: { title, description, type: 'website', locale: 'en_US' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster
          position="bottom-center"
          toastOptions={{ style: { borderRadius: 12, fontSize: 13, fontWeight: 600, background: '#0a0a0a', color: '#fff' } }}
        />
      </body>
    </html>
  );
}
