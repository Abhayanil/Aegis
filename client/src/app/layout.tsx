import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Aegis - AI-Powered Deal Analysis',
  description: 'Quickly screen venture capital deals with AI-powered analysis and benchmarking',
  keywords: ['venture capital', 'deal analysis', 'AI', 'investment', 'due diligence'],
  authors: [{ name: 'Aegis Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}