import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookChallenge, verifyWebhookSignature } from "@/lib/facebook-graph";
import { recordIncomingMessage, upsertParticipantIfStale } from "@/lib/facebook-inbox-store";
import { broadcast } from "@/lib/realtime";

// Meta gọi GET đúng 1 lần lúc seller (chủ sàn) đăng ký Webhook URL này trên App Dashboard —
// phải trả lại đúng "hub.challenge" thì Meta mới lưu URL, xem verifyWebhookChallenge().
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = verifyWebhookChallenge(
    url.searchParams.get("hub.mode"),
    url.searchParams.get("hub.verify_token"),
    url.searchParams.get("hub.challenge")
  );
  if (!challenge) return NextResponse.json({ error: "invalid verify token" }, { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

type MessagingEvent = {
  sender?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
};

type WebhookPayload = {
  object?: string;
  entry?: Array<{ id?: string; messaging?: MessagingEvent[] }>;
};

// Không đặt sau requireAdmin() — request này tới từ server Facebook, không có phiên đăng
// nhập. Xác thực bằng chữ ký HMAC-SHA256 ký bởi App Secret (verifyWebhookSignature), giống
// tinh thần webhook SePay/GHN đã có (xem src/app/api/webhooks/sepay, .../ghn).
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256")))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.object !== "page") return NextResponse.json({ ok: true });

  for (const entry of payload.entry ?? []) {
    const pageId = entry.id;
    if (!pageId) continue;

    for (const event of entry.messaging ?? []) {
      // Chỉ xử lý tin nhắn KHÁCH gửi tới — app chỉ đăng ký field "messages" (không đăng ký
      // "messaging_echoes"), is_echo lẽ ra không xảy ra nhưng chặn thêm cho chắc: tin PAGE tự
      // gửi đã được ghi lại trực tiếp ngay khi gọi Send API (xem sendFacebookMessage trong
      // src/lib/actions/facebook-inbox.ts), ghi lại lần nữa ở đây sẽ tạo dữ liệu trùng hướng.
      const psid = event.sender?.id;
      const mid = event.message?.mid;
      if (!psid || !mid || event.message?.is_echo) continue;

      const text = event.message?.text?.trim() || "📎 Đã gửi tệp đính kèm (sticker/ảnh/voice) — mở Facebook để xem";
      const createdAt = event.timestamp ? new Date(event.timestamp) : new Date();

      await recordIncomingMessage(pageId, psid, mid, text, createdAt);
      await broadcast(`fb:${pageId}`, "message");

      const connection = await prisma.facebookPageConnection.findFirst({ where: { pageId } });
      if (connection) {
        await upsertParticipantIfStale(pageId, psid, connection.pageAccessToken).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
