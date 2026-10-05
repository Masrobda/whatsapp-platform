import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

// On supprime l'import next/font/google pour éviter le fetch réseau pendant le build
// On utilise un fallback système + variables CSS pour simuler Geist

export const metadata: Metadata = {
  title: "Dashboard NEXT LTD",
  description: "Tableau de bord Numeric Export",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Optionnel : preload fallback si tu veux une font proche */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`
          antialiased
          font-sans
          bg-background
          text-foreground
          [--font-geist-sans:ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"]
          [--font-geist-mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace]
        `}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  );
}
