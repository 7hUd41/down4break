import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// URL absolue de base pour résoudre les chemins relatifs des og:image, twitter:image, etc.
// Priorité : NEXT_PUBLIC_SITE_URL (si on set un custom domain) > RAILWAY_PUBLIC_DOMAIN
// (auto-exposé par Railway) > localhost en dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "http://localhost:3000");

// Metadata par défaut pour la landing. Les pages /r/[code] surchargent
// dynamiquement via leur propre generateMetadata.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "down4break?",
  description: "u down for a break? — pomodoro social pour coworkers.",
  openGraph: {
    title: "down4break?",
    description: "u down for a break? — pomodoro social pour coworkers.",
    images: ["/logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "down4break?",
    description: "u down for a break?",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
