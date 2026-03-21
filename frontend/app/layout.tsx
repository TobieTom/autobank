import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AUTOBANK — Self-Sustaining AI Lending Protocol",
  description:
    "Autonomous AI agent lending on Ethereum. LLaMA 3 powered loan decisions. Self-sustaining compute loop. Tether WDK Hackathon Galactica.",
  keywords: ["DeFi", "AI agents", "lending", "Ethereum", "Tether", "USDT", "autonomous"],
  authors: [{ name: "AUTOBANK" }],
  openGraph: {
    title: "AUTOBANK — Self-Sustaining AI Lending Protocol",
    description: "Autonomous AI agent lending powered by LLaMA 3 and Tether WDK",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#08080F",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`
          ${syne.variable}
          ${dmSans.variable}
          ${jetbrainsMono.variable}
          font-body antialiased
          bg-bg text-text-primary
          min-h-screen
        `}
      >
        {children}
      </body>
    </html>
  );
}
