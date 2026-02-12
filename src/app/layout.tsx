import type { Metadata } from "next";
import { Syne, Space_Grotesk } from "next/font/google";
import "./globals.css";
import AuthHashRedirector from "@/app/AuthHashRedirector";
import AuthSessionSync from "@/app/AuthSessionSync";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "thefunction",
  description: "Your Spotify stats",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <AuthHashRedirector />
        <AuthSessionSync />
        {children}
      </body>
    </html>
  );
}
