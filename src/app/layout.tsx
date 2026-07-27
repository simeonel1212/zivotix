import type { Metadata, Viewport } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import Footer from "@/components/footer";
import SiteHeader from "@/components/site-header";
import { appUrl } from "@/lib/app-url";
import "./globals.css";

// Modern geometric sans for the whole site — Poppins.
const poppins = Poppins({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_NAME = "Zivotix";
const DEFAULT_TITLE = "Zivotix | Find & sell event tickets";
const DEFAULT_DESCRIPTION =
  "Discover events, buy tickets in seconds, and sell out your next show. Secure checkout, instant QR tickets, fast payouts.";

// metadataBase is what lets every relative OG/canonical URL elsewhere in the
// app resolve to a real absolute link. Without it Next emits relative og:image
// paths, which crawlers and link unfurlers (WhatsApp, X, Slack) silently drop.
export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: DEFAULT_TITLE,
    // Page-level `title: "Foo"` renders as "Foo | Zivotix" automatically.
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "event tickets",
    "buy tickets online",
    "sell event tickets",
    "concert tickets",
    "party tickets",
    "Nigeria events",
    "Lagos events",
    "Thailand events",
    "Bangkok events",
    "event ticketing platform",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: appUrl(),
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Google Search Console ownership proof. Must stay in place permanently —
  // removing it un-verifies the property.
  verification: { google: "XlmzUW1KsrMGhM7pvWYjckQRFi1Rv8azdwlI3yPjEqE" },
  // Installable-app metadata. Android reads /manifest.webmanifest (emitted by
  // src/app/manifest.ts); iOS ignores most of it and needs these instead.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Zivotix",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

// Keeps the scanner's camera view edge-to-edge on notched phones instead of
// letterboxed between two black bars.
export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        <Footer />
      </body>
    </html>
  );
}
