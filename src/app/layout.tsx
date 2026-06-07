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
          Vercel observability scripts — production only. Skipping in dev keeps
          quota usage flat during local iteration; both scripts 404 harmlessly
          in dev anyway (Vercel only serves them in deployed environments), but
          the explicit guard avoids the network round-trip entirely.

          Loaded via first-party Vercel script paths rather than the npm
          packages (@vercel/speed-insights, @vercel/analytics), which have a
          peer-dep conflict with the Vitest/Vite toolchain.
        */}
        {process.env.NODE_ENV === "production" && (
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
