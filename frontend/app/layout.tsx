import type { Metadata } from "next";
import { BackendWarmup } from "@/components/BackendWarmup";
import "./globals.css";

export const metadata: Metadata = {
  title: "StepWise — inspect the computation",
  description:
    "StepWise computes STEM results with Wolfram Language, checks numeric claims, and shows the provenance beside the explanation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <BackendWarmup />
        {children}
      </body>
    </html>
  );
}
