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
          Vercel observability scripts — production deployment only. VERCEL_ENV
          is "production" only for the main production deployment; preview
          deployments get "preview" and local dev is undefined. This keeps quota
          usage flat during iteration: previews and local dev are excluded, only
          real production traffic is measured.

          Loaded via first-party Vercel script paths rather than the npm
          packages (@vercel/speed-insights, @vercel/analytics), which have a
          peer-dep conflict with the Vitest/Vite toolchain.
        */}
        {process.env.VERCEL_ENV === "production" && (
          <>
            <Script
              src="/_vercel/speed-insights/script.js"
              strategy="afterInteractive"
            />
            <Script
              src="/_vercel/insights/script.js"
              strategy="afterInteractive"
            />
          </>
        )}
      </body>
    </html>
  );
}
