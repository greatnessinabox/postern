import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const inter = localFont({
  variable: '--font-inter',
  display: 'swap',
  src: [
    {
      path: '../../../packages/ui/fonts/inter/InterVariable.woff2',
      weight: '100 900',
      style: 'normal',
    },
    {
      path: '../../../packages/ui/fonts/inter/InterVariable-Italic.woff2',
      weight: '100 900',
      style: 'italic',
    },
  ],
})

const sourceSerif = localFont({
  variable: '--font-source-serif',
  display: 'swap',
  src: [
    {
      path: '../../../packages/ui/fonts/source-serif-4/SourceSerif4Variable-Roman.woff2',
      weight: '200 900',
      style: 'normal',
    },
    {
      path: '../../../packages/ui/fonts/source-serif-4/SourceSerif4Variable-Italic.woff2',
      weight: '200 900',
      style: 'italic',
    },
  ],
})

export const metadata: Metadata = {
  title: 'Postern',
  description: 'No inbox. Just correspondence.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  )
}
