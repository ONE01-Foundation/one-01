import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ONE — move things forward",
  description:
    "Your digital representative for turning intentions into living processes. ONE is the layer between what you want and what needs to happen.",
  icons: {
    icon: "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='28' fill='%230A0A0A'/%3E%3Ccircle cx='25' cy='29' r='4.5' fill='%23fff'/%3E%3Ccircle cx='39' cy='29' r='4.5' fill='%23fff'/%3E%3C/svg%3E",
  },
  openGraph: {
    title: "ONE — move things forward",
    description:
      "Your digital representative for turning intentions into living processes.",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
