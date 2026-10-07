import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "마포홈 운영센터",
  description: "마포구 원룸·오피스텔 수집과 알림 운영",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}

