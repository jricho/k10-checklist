import type { Metadata } from "next";
import { Space_Grotesk, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Typography — see the rationale block in globals.css, and CLAUDE.md for the
// outstanding brand confirmation.
//
// Three faces, each doing a distinct job, all self-hosted and subset by
// next/font so there is no render-blocking request to Google and no layout
// shift. Swapping any of them is one line here: nothing downstream names a
// family, they all read --font-* tokens.

const display = Space_Grotesk({
  variable: "--font-display-face",
  subsets: ["latin"],
  display: "swap",
  // Headings only, so the weight range stays narrow.
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Veeam Kasten | Readiness & Operating Maturity",
  description:
    "Guided assessment for Veeam Kasten, from proof of concept through production readiness to day-2 operational maturity. Verify against a live cluster and export a signable evidence pack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${code.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
