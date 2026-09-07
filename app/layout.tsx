import type { Metadata, Viewport } from 'next';
import {
  appPath,
  CANONICAL_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from '@/lib/site';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_URL + '/'),
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
  manifest: appPath('/manifest.webmanifest'),
  icons: {
    icon: [
      { url: appPath('/favicon.svg'), type: 'image/svg+xml' },
      { url: appPath('/icon-192.png'), sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: appPath('/apple-touch-icon.png'), sizes: '180x180' },
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Chesscape' },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: CANONICAL_URL,
    siteName: 'Chesscape',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
        <link
          rel="sitemap"
          type="application/xml"
          href={appPath('/sitemap.xml')}
        />
        <link rel="describedby" type="text/plain" href={appPath('/llms.txt')} />
        <link
          rel="alternate"
          type="text/markdown"
          href={appPath('/index.md')}
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
