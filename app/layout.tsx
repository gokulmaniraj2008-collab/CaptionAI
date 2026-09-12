import type { Metadata } from "next";
import "./globals.css";
import UploadGuard from "@/components/UploadGuard";

export const metadata: Metadata = {
  title: "CaptionAI — AI Video Captions",
  description: "Turn spoken English into accurate, synchronized captions.",
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <UploadGuard />
      </body>
    </html>
  );
}
