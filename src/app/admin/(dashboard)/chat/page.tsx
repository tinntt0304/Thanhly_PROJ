import { redirect } from "next/navigation";

// Đã gộp vào /admin/ho-tro (tab "Khách hàng") — giữ redirect ở đây phòng link/bookmark cũ.
export default function AdminChatRedirectPage() {
  redirect("/admin/ho-tro");
}
