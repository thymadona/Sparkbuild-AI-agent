import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Student Code Builder',
  description: 'Build web apps with AI — type a prompt, get a live preview',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-surface-900 text-gray-100 min-h-screen antialiased font-body">
        {children}
      </body>
    </html>
  )
}
