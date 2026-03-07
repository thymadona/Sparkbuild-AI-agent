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
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
