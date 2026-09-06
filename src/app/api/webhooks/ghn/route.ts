import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

// GHN gọi endpoint này khi vận đơn đổi trạng thái (tài liệu: api.ghn.vn/home/docs/detail?id=47).
// Khác SePay, GHN KHÔNG có cơ chế ký/xác thực request nào (không header token, không chữ ký
// HMAC) — chỉ cấu hình bằng cách gửi URL cho GHN qua form liên hệ/portal đối tác. Để giảm rủi
// ro ai đó đoán được URL và giả mạo request, hỗ trợ thêm 1 query param bí mật tuỳ chọn: nếu
// đặt GHN_WEBHOOK_SECRET thì request phải kèm đúng ?key=<secret>, không đặt thì bỏ qua bước
// này (vẫn hoạt động ngay, đúng quy ước "biến môi trường tuỳ chọn" của dự án).
function isAuthorized(request: Request): boolean {
  const expected = process.env.GHN_WEBHOOK_SECRET;
  if (!expected) return true;
  const url = new URL(request.url);
  return url.searchParams.get("key") === expected;
}

const payloadSchema = z.object({
  OrderCode: z.string().min(1),
  ClientOrderCode: z.string().nullish(),
  Status: z.string().min(1),
  // GHN kèm lý do (đặc biệt cho delivery_fail/exception, vd. "Khách không nghe máy") ở 1 trong
  // các field này tuỳ phiên bản webhook — chấp nhận cả 3, dùng field nào có giá trị trước.
  Reason: z.string().nullish(),
  ReasonCode: z.string().nullish(),
  Description: z.string().nullish(),
});

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    // Trả 200 cho các sự kiện không đúng khuôn dạng ta cần (vd. Type khác mong đợi) thay vì
    // 4xx — tránh GHN hiểu lầm là lỗi tạm thời rồi retry 10 lần/5 giây liên tục vô ích.
    return NextResponse.json({ ok: true, skipped: "unrecognized payload shape" });
  }
  const { OrderCode, Status, Reason, ReasonCode, Description } = parsed.data;
  const ghnStatusReason = Reason || Description || ReasonCode || null;

  // ghnOrderCode không có ràng buộc unique ở schema (chỉ đánh index) nên dùng findFirst —
  // về lý thuyết 1 mã vận đơn GHN chỉ gắn với đúng 1 Order vì ta tự tạo ra mã này lúc gọi
  // shipping-order/create và lưu lại ngay, không có đường nào trùng.
  const order = await prisma.order.findFirst({ where: { ghnOrderCode: OrderCode } });
  if (!order) {
    return NextResponse.json({ ok: true, skipped: "no matching order" });
  }

  // ghnStatus/ghnStatusReason luôn ghi được (thông tin tham khảo, luôn ghi lại kể cả null khi sự
  // kiện này không kèm lý do — lý do luôn gắn với ĐÚNG lần cập nhật trạng thái mới nhất, không
  // giữ lại lý do cũ của lần trước). RIÊNG status nội bộ chỉ chuyển sang DELIVERED khi GHN báo
  // "delivered", và dùng updateMany với điều kiện status ĐỌC LẠI ngay tại thời điểm ghi (không
  // phải biến `order` đã đọc trước đó) — tránh mất cập nhật nếu cancelOrder huỷ đơn đúng lúc
  // webhook này đang xử lý (đã gặp thật: webhook đọc status cũ "SHIPPING" rồi ghi đè lại y hệt
  // ngay sau khi admin vừa huỷ xong, làm đơn "sống lại" dù ghnStatus đã lên "cancel").
  await prisma.order.update({
    where: { id: order.id },
    data: { ghnStatus: Status, ghnStatusReason },
  });
  if (Status === "delivered") {
    await prisma.order.updateMany({
      where: { id: order.id, status: { notIn: ["CANCELLED", "DELIVERED"] } },
      data: { status: "DELIVERED" },
    });
  }

  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/orders");
  return NextResponse.json({ ok: true });
}
