import Link from "next/link";

// Tab phân biệt rõ 2 đối tượng đăng nhập/đăng ký hoàn toàn khác nhau của site (tài khoản
// Buyer vs tài khoản User người bán) — trước đây header chỉ có "Đăng nhập/Đăng ký" (buyer) và
// "Người bán" (admin) nằm cạnh nhau, dễ gây hiểu lầm không biết bấm vào cái nào. Đặt ở đầu cả
// 4 trang /dang-nhap, /dang-ky, /admin/login, /admin/register để chuyển qua lại rõ ràng —
// chuyển tab là chuyển hẳn trang (2 luồng nghiệp vụ khác nhau hoàn toàn: seller có OTP email,
// buyer không), không cố gộp chung 1 form.
export function AuthAudienceTabs({
  active,
  mode,
}: {
  active: "buyer" | "seller";
  mode: "login" | "register";
}) {
  const buyerHref = mode === "login" ? "/dang-nhap" : "/dang-ky";
  const sellerHref = mode === "login" ? "/admin/login" : "/admin/register";

  const tabClass = (isActive: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors ${
      isActive ? "bg-accent-500 text-white" : "text-neutral-600 hover:bg-neutral-100"
    }`;

  return (
    <div className="flex gap-1 rounded-lg border border-neutral-300 bg-surface p-1">
      <Link href={buyerHref} className={tabClass(active === "buyer")}>
        Mua hàng / Đấu giá
      </Link>
      <Link href={sellerHref} className={tabClass(active === "seller")}>
        Người bán
      </Link>
    </div>
  );
}
