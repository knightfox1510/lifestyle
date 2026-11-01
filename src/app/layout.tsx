import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { ServiceWorker } from "@/components/service-worker";
import { isLang, LANG_COOKIE } from "@/lib/i18n/core";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute URLs for the social preview image etc.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "Hearth", template: "%s · Hearth" },
  description: "Household and partner lifestyle tracker: health, food, routines and more.",
  applicationName: "Hearth",
  appleWebApp: { capable: true, title: "Hearth", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Hearth",
    description: "Health, food & home, together.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Hearth: health, food & home, together." }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#141412" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  return (
    <html lang={isLang(c) ? c : "en"} className="h-full antialiased">
      <body className="min-h-full font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
