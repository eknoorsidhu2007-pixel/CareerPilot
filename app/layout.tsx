import type { Metadata } from "next";
import { Outfit, DM_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CareerPilot — AI Career Copilot",
  description:
    "Upload your resume once. Let CareerPilot analyze your skills, match you to the best roles, and guide your growth.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} ${dmMono.variable} font-sans antialiased bg-bg text-text min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
