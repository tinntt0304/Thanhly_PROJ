import type { Metadata } from "next";
import { Baloo_2, Be_Vietnam_Pro, Caprasimo } from "next/font/google";
import "./globals.css";

// Heading font — dùng cho toàn bộ tiêu đề tiếng Việt trong app (có subset "vietnamese").
// Biến đặt tên khác với token Tailwind "--font-heading" (map ở globals.css) để tránh
// tự tham chiếu vòng lặp khi cả hai cùng gắn trên phần tử <html>.
const baloo2 = Baloo_2({
  variable: "--font-baloo",
  subsets: ["vietnamese", "latin"],
  weight: ["500", "700", "800"],
});

// Body font — dùng cho toàn bộ nội dung/form tiếng Việt (có subset "vietnamese").
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "700"],
});

// Chỉ dùng cho đúng chữ "hifen" trong logo (thuần Latin, không dấu) — Caprasimo không có
// subset tiếng Việt nên KHÔNG dùng cho bất kỳ tiêu đề tiếng Việt nào (xem Logo.tsx).
const caprasimo = Caprasimo({
  variable: "--font-caprasimo",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "hifen — Đồ mẹ & bé, thú cưng thanh lý",
  description: "Trang thanh lý đồ mẹ & bé, thú cưng kiểu đấu giá — trả giá bằng SĐT, không cần tài khoản.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${baloo2.variable} ${beVietnamPro.variable} ${caprasimo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text font-body">{children}</body>
    </html>
  );
}
