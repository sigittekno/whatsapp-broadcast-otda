import type {Metadata} from 'next';
import './globals.css'; // Global styles
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Kemendagri Otda WA Broadcast',
  description: 'Dashboard broadcast WhatsApp untuk Kepala Daerah dan Internal Kemendagri Otda.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
