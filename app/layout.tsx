import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abhy",
  description: "Small habits. Real stakes. Miss a habit, owe a friend.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Abhy",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf8f4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-lg px-4 pb-16">{children}</div>
      </body>
    </html>
  );
}
