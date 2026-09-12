import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaptionAI — AI Video Captions",
  description: "Turn spoken English into accurate, synchronized captions.",
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}