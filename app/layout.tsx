import type { Metadata } from "next";
import { Manrope, Fraunces, Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

// Used by the /elicit-clone route — the Elicit recreation calls for Inter
// per its design spec while Evoke proper sticks with Manrope/Fraunces.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Evoke — Open-source research papers, screened and synthesized",
  description: "Find the right research papers even without the right keywords. Semantic paper search + AI synthesis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-bg text-text">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
