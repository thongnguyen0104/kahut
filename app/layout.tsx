import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque } from "next/font/google";
import { AuthProvider } from "@/lib/client/auth";
import { APP_NAME } from "@/lib/config";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import "./globals.css";

// Body text: drawn for Vietnamese. Display: chunky grotesque for headings and numbers.
const body = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Real-time multiplayer quiz game · Đố vui thời gian thực",
  // Never leak URLs to other sites.
  referrer: "same-origin",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff4e2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
