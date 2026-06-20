import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FertiScope — Multilingual Tokenizer Fertility & Cost Analyzer",
  description:
    "See tokenizer fertility, cost multiplier, and multi-turn context risk for Asian languages before you deploy a multilingual LLM.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/10 px-4 py-6 text-center text-xs text-gray-500">
          FertiScope · token economics are exact · multi-turn accuracy risk is an estimate, not a prediction ·
          corpus: FLORES-200 (CC-BY-SA 4.0)
        </footer>
      </body>
    </html>
  );
}
