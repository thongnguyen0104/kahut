import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Real-time multiplayer quiz game · Đố vui thời gian thực",
  // Editor URLs carry the secret edit key: never leak it to other sites.
  referrer: "same-origin",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1220",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
