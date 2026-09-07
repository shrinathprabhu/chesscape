import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Chesscape — Find your escape',
  description:
    'One position. Thirty seconds. A daily chess challenge where your only job is to escape checkmate.',
  alternates: { canonical: 'https://lowkey.tools/chesscape' },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/icon-192.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Chesscape' },
  openGraph: {
    title: 'Chesscape — Find your escape',
    description:
      'One position. Thirty seconds. Find the move that keeps you alive.',
    url: 'https://lowkey.tools/chesscape',
    type: 'website',
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#f7f8f2" />
      </head>
      <body>{children}</body>
    </html>
  );
}
