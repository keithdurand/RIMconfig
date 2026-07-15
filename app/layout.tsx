import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horn Rim Visualizer",
  description: "Internal two-spline horn rim development tool",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
