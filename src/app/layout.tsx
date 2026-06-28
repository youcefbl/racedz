import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Suspense } from "react";

// One type family across the whole site: Manrope — modern, geometric, subtly
// rounded but crisp. Headings and body share it; hierarchy comes from size/
// spacing/color, not extra fonts or heavy weights. (Logo wordmark is vector art.)
// To try another face, swap `Manrope` for `Plus_Jakarta_Sans` or `DM_Sans` here.
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
import { HtmlLangDir } from "@/components/layout/html-lang-dir";
import { NativeChrome } from "@/components/layout/native-chrome";
import { NativeTransition } from "@/components/layout/native-transition";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ZidRun",
    template: "%s | ZidRun"
  },
  description: "Find, register, and manage races across Algeria.",
  metadataBase: new URL("https://zidrun.com"),
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
    title: "ZidRun"
  }
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#15803D" },
    { media: "(prefers-color-scheme: dark)", color: "#080d18" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('racedz-theme');document.documentElement.dataset.theme=(t==='dark'||t==='race'||t==='light')?t:'light'}catch(e){document.documentElement.dataset.theme='light'}" +
              "try{var l=new URLSearchParams(location.search).get('lang');l=(l==='fr'||l==='ar')?l:'en';document.documentElement.lang=l;document.documentElement.dir=(l==='ar')?'rtl':'ltr';}catch(e){}"
          }}
        />
        <Suspense fallback={null}>
          <HtmlLangDir />
        </Suspense>
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        <main className="flex-1">
          <NativeTransition>{children}</NativeTransition>
        </main>
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
        <Suspense fallback={null}>
          <NativeChrome />
        </Suspense>
        <PullToRefresh />
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
