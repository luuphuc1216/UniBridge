import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UniBridge",
  description: "Nền tảng kết nối doanh nghiệp với nhóm sinh viên.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
