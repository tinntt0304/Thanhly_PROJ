import { redirect } from "next/navigation";
import { buyerAuth } from "@/lib/buyer-auth";

// Dùng ở nơi bắt buộc đăng nhập (trang giỏ hàng, tài khoản, lịch sử đơn) — mirror
// requireAdmin() ở admin-guard.ts nhưng redirect về /dang-nhap thay vì /admin/login.
export async function requireBuyer() {
  const session = await buyerAuth();
  if (!session) {
    redirect("/dang-nhap");
  }
  return session;
}

// Dùng ở nơi đăng nhập là TUỲ CHỌN (trang sản phẩm khi đặt giá/mua ngay, SiteHeader) — không
// redirect, chỉ trả null nếu chưa đăng nhập.
export async function getBuyerSession() {
  return buyerAuth();
}
