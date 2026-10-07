import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const title = 'MeetingMind · AI meeting notes, action items & follow-ups';
const description =
  'Record or upload a meeting and get a summary, decisions, action items with owners and due dates, and a ready-to-send follow-up email. Runs in your browser.';

export const metadata: Metadata = {
  title,
  description,
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/logo.svg` },
  openGraph: { title, description, type: 'website', locale: 'en_US' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: 12, fontSize: 14 } }} />
      </body>
    </html>
  );
}
