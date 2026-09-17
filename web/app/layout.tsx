import type { Metadata } from "next";
import { Sora, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Astryon — Learning in pieces. Understanding as a whole.",
  description: "Active learning construction platform that breaks content into atomic concepts and synthesizes them into connected understanding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#050A14] text-[#F0F6FF] antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
