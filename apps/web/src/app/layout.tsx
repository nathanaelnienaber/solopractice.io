import type { Metadata } from "next";
import { Providers } from "./providers";
import { themeInitScript } from "@/lib/theme-boot";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoloPractice",
  description: "Local-first therapy practice management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
