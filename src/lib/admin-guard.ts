import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Bất kỳ tài khoản đã đăng nhập nào (SUPERADMIN hoặc SELLER) — dùng cho các thao tác
// chung như đăng/sửa sản phẩm của chính mình.
export async function requireAdmin() {
  const session = await auth();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

// Chỉ tài khoản vận hành sàn (SUPERADMIN) — dùng cho quản lý menu điều hướng, thông
// báo & tin tức, trang "Về chúng tôi", bằng chứng uy tín, chat hỗ trợ.
export async function requireSuperAdmin() {
  const session = await requireAdmin();
  if (session.user.role !== "SUPERADMIN") {
    redirect("/admin");
  }
  return session;
}
