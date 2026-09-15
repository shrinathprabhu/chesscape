import type { Metadata, Viewport } from 'next';
import '@fontsource/play/latin-400.css';
import '@fontsource/play/latin-700.css';
import { CANONICAL_URL, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: 'Chesscape',
  authors: [{ name: 'Shrinath Prabhu', url: 'https://shrinath.me' }],
  creator: 'Shrinath Prabhu',
  publisher: 'Lowkey Tools',
  category: 'games',
  alternates: { canonical: CANONICAL_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Chesscape' },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: CANONICAL_URL,
    siteName: 'Chesscape',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: `${CANONICAL_URL}og.png`,
        width: 1730,
        height: 909,
        type: 'image/png',
        alt: 'Chesscape. Find your escape. One position. Thirty seconds. Your move. An ivory king on a green chessboard.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@shrinath_prabhu',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${CANONICAL_URL}og.png`,
        alt: 'Chesscape — find your escape in thirty seconds.',
      },
    ],
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f8f2',
  colorScheme: 'light',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="sitemap" type="application/xml" href={'/sitemap.xml'} />
        <link rel="describedby" type="text/plain" href={'/llms.txt'} />
        <link
          rel="alternate"
          type="text/markdown"
          href={'/index.md'}
          title="Chesscape rules and FAQ in Markdown"
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to the chess puzzle
        </a>
        <noscript>
          <p className="no-script-note">
            Enable JavaScript to play Chesscape. You can still read the rules
            and frequently asked questions below.
          </p>
        </noscript>
        {children}
      </body>
    </html>
  );
}
