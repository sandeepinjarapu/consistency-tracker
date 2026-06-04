import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consistency Tracker",
  description:
    "A calm, private habit tracker with weekly reflections and partner accountability.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {/*
          Vercel Speed Insights — loaded via Vercel's first-party script rather
          than the @vercel/speed-insights npm package, which has a peer-dep
          conflict with our Vitest/Vite toolchain. The script is served by
          Vercel only when Speed Insights is enabled for the project (Dashboard
          → Speed Insights → Enable); it 404s harmlessly in local dev.
        */}
        <Script
          src="/_vercel/speed-insights/script.js"
          strategy="afterInteractive"
        />
        {/*
          Vercel Web Analytics — same first-party-script approach as Speed
          Insights above (the @vercel/analytics npm package has the same
          Vite/Vitest peer-dep conflict). Served by Vercel only when Web
          Analytics is enabled for the project; 404s harmlessly in local dev.
          Cookieless, so no consent banner is required.
        */}
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
