import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Suspense } from "react";

// One type family across the whole site: Manrope — modern, geometric, subtly
// rounded but crisp. Headings and body share it; hierarchy comes from size/
// spacing/color, not extra fonts or heavy weights. (Logo wordmark is vector art.)
// To try another face, swap `Manrope` for `Plus_Jakarta_Sans` or `DM_Sans` here.
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
import { AnalyticsTracker } from "@/components/analytics/analytics-tracker";
import { GpsScrollTrailGate } from "@/components/layout/gps-scroll-trail-gate";
import { HtmlLangDir } from "@/components/layout/html-lang-dir";
import { NativeChrome } from "@/components/layout/native-chrome";
import { NativeDeepLinks } from "@/components/layout/native-deep-links";
import { NativePush } from "@/components/layout/native-push";
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
  description: "Discover races, register, and train with an AI coach across Algeria.",
  metadataBase: new URL("https://zidrun.com"),
  openGraph: {
    type: "website",
    siteName: "ZidRun",
    title: "ZidRun",
    description: "Discover races, register, and train with an AI coach across Algeria.",
    url: "https://zidrun.com"
  },
  twitter: {
    card: "summary_large_image",
    title: "ZidRun",
    description: "Discover races, register, and train with an AI coach across Algeria."
  },
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
          <AnalyticsTracker />
        </Suspense>
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        <Suspense fallback={null}>
          <GpsScrollTrailGate />
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
        <NativeDeepLinks />
        <NativePush />
        <PullToRefresh />
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
