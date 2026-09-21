import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'solopractice',
  description: 'Client portal for solo mental health practice',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <h1 className="text-xl font-semibold text-primary-600">solopractice</h1>
            </div>
          </header>
          <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
          <footer className="border-t border-gray-200 bg-white mt-auto">
            <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-gray-500">
              Secure client portal. Your clinical data is stored only on your therapist&apos;s
              local device.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
