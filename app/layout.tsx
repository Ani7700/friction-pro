import './globals.css';
import "katex/dist/katex.min.css";
import type { Metadata } from 'next';
import { inter } from './fonts';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Fr(i)ction: Feedback to Revision with AI Support in Action',
  description:
    'Fr(i)ction stands for Feedback to Revision with AI Support in Action.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} relative overflow-hidden text-gray-800`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
