import type { Metadata, Viewport } from 'next'
import './globals.css'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// viewportFit lets the board's safe-area padding (see board-root in
// BoardView.tsx) clear the iPhone home-indicator strip. interactiveWidget
// keeps Android Chrome's on-screen keyboard from covering bottom-anchored
// inputs. No maximumScale/userScalable: disabling pinch-zoom fails WCAG 1.4.4.
export const viewport: Viewport = {
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  // Resolves app/icon.svg and app/opengraph-image.tsx to absolute URLs, which
  // og:image requires — a relative one is ignored by every unfurler.
  metadataBase: new URL(siteUrl),
  title: 'Student Code Builder',
  description: 'Build web apps with AI — type a prompt, get a live preview',
  openGraph: {
    type: 'website',
    siteName: 'Student Code Builder',
    title: 'Student Code Builder',
    description: 'Build web apps with AI — type a prompt, get a live preview',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Student Code Builder',
    description: 'Build web apps with AI — type a prompt, get a live preview',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-900 min-h-dvh antialiased font-body">{children}</body>
    </html>
  )
}
