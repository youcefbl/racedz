import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { NativeChrome } from "@/components/layout/native-chrome";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RaceDZ",
    template: "%s | RaceDZ"
  },
  description: "Find, register, and manage races across Algeria.",
  metadataBase: new URL("https://racedz.dz"),
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" }
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RaceDZ"
  }
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F766E" },
    { media: "(prefers-color-scheme: dark)", color: "#080d18" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('racedz-theme');document.documentElement.dataset.theme=(t==='dark'||t==='race'||t==='light')?t:'light'}catch(e){document.documentElement.dataset.theme='light'}"
          }}
        />
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        <main className="flex-1">{children}</main>
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
        <Suspense fallback={null}>
          <NativeChrome />
        </Suspense>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
