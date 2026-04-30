import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./components/Providers";
import Script from "next/script";

export const metadata: Metadata = {
  title: "PDF Viewer",
  description: "Fast, CDN-cached PDF presentations with selectable text",
    icons: {
        icon: '/favicon.ico?v=2', // Changing v=1 to v=2 forces a redownload
    },

};
// app/layout.tsx

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  return (
      <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
            href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&display=swap"
            rel="stylesheet"
        />
          <link
              href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;600;700&display=swap"
              rel="stylesheet"
          />
        <Script
          defer
          src="https://analytics.raffertysmith.com/stats"
          data-website-id="c44192b7-b209-42d2-9e5c-e99a7c268175"
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
      </html>
  );
}
