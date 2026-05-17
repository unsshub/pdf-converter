import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'PDF Converter - Your PDF Editor',
  description: 'Convert PDF files to Word, Excel, PowerPoint and more with incredible accuracy.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
