import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Senimen Books App',
  description: 'Жеке кітаптар платформасы',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="kk" className="h-full antialiased">
      <head>
        <link href="https://fonts.cdnfonts.com/css/gilroy" rel="stylesheet" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,500;0,600;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[var(--bg-page)] text-[var(--text-primary)]">{children}</body>
    </html>
  )
}
