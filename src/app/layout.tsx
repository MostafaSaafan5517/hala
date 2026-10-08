import type { Metadata } from "next";
import { Geist_Mono, Readex_Pro } from "next/font/google";
import { appConfig } from "@/config/app";
import "./globals.css";

// One family for both scripts: Readex Pro's Arabic was drawn alongside its Latin
// (docs/design/DESIGN.md). Geist Mono is for code only.
const readex = Readex_Pro({
  variable: "--font-readex",
  subsets: ["latin", "arabic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: appConfig.name, template: `%s | ${appConfig.name}` },
  description: appConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${readex.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
