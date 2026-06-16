import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RaceDZ",
    template: "%s | RaceDZ"
  },
  description: "Find, register, and manage races across Algeria.",
  metadataBase: new URL("https://racedz.dz")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('racedz-theme');document.documentElement.dataset.theme=(t==='dark'||t==='race'||t==='light')?t:'light'}catch(e){document.documentElement.dataset.theme='light'}"
          }}
        />
        <Suspense fallback={null}>
          <SiteHeader />
        </Suspense>
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
