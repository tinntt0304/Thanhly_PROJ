// Đấu nối Meta Graph API (https://developers.facebook.com/docs/graph-api) để lấy hội thoại
// Messenger + bình luận bài đăng của 1 fanpage, và trả lời trực tiếp — dùng ở
// /admin/hop-thu-facebook. Seller cấp quyền qua flow OAuth "Kết nối với Facebook" (Facebook
// Login) cho ĐÚNG Meta App của chủ sàn (FACEBOOK_APP_ID/FACEBOOK_APP_SECRET trong .env) — xem
// src/app/api/auth/facebook/{start,callback}/route.ts. Quyền xin lúc cấp phép: pages_show_list,
// pages_read_engagement, pages_manage_metadata (bắt buộc để token có "MESSAGING task"),
// pages_messaging (đọc/gửi tin nhắn Messenger), pages_manage_engagement (trả lời bình luận).
// Các quyền nhạy cảm này Meta yêu cầu App Review (Advanced Access) mới đọc/trả lời được hội
// thoại với NGƯỜI DÙNG BẤT KỲ — trước khi qua review, app chỉ đọc/trả lời được hội thoại với
// những tài khoản Facebook đã được thêm làm Tester/Developer/Admin của App (App Dashboard >
// Vai trò trong ứng dụng), hội thoại với người ngoài danh sách này sẽ KHÔNG xuất hiện qua
// Graph API dù trang có nhắn thật cho fanpage. Nếu token thiếu quyền, Graph API trả lỗi rõ
// ràng (xem GraphApiError) thay vì crash trang.

const GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
export const FACEBOOK_OAUTH_SCOPES =
  "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging,pages_manage_engagement";

export class GraphApiError extends Error {
  constructor(
    message: string,
    public code?: number
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

type GraphErrorBody = { error?: { message?: string; code?: number } };

async function graphFetch<T>(path: string, accessToken: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const body = json as GraphErrorBody;
    throw new GraphApiError(body.error?.message || "Gọi Facebook Graph API thất bại.", body.error?.code);
  }
  return json as T;
}

async function graphPost<T>(path: string, accessToken: string, body: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const params = new URLSearchParams({ ...body, access_token: accessToken });

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    const errBody = json as GraphErrorBody;
    throw new GraphApiError(errBody.error?.message || "Gọi Facebook Graph API thất bại.", errBody.error?.code);
  }
  return json as T;
}

// --- OAuth (Facebook Login) — đổi authorization code lấy token, rồi lấy danh sách fanpage
// seller quản lý kèm Page Access Token của từng trang. Xem route.ts start/callback.

export async function exchangeCodeForUserToken(code: string, redirectUri: string): Promise<string> {
  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const body = json as GraphErrorBody;
    throw new GraphApiError(body.error?.message || "Đổi authorization code lấy token thất bại.", body.error?.code);
  }
  return (json as { access_token: string }).access_token;
}

// Đổi user access token ngắn hạn (vài giờ) lấy bản dài hạn (~60 ngày) — Page Access Token suy
// ra TỪ token dài hạn này (qua listManagedPages) sẽ không tự hết hạn theo thời gian như vậy
// (chỉ mất hiệu lực nếu seller tự thu hồi quyền hoặc đổi mật khẩu Facebook).
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    const body = json as GraphErrorBody;
    throw new GraphApiError(body.error?.message || "Đổi token dài hạn thất bại.", body.error?.code);
  }
  return (json as { access_token: string }).access_token;
}

export type ManagedPage = { id: string; name: string; accessToken: string };

export async function listManagedPages(userAccessToken: string): Promise<ManagedPage[]> {
  const data = await graphFetch<{ data: Array<{ id: string; name: string; access_token: string }> }>(
    "/me/accounts",
    userAccessToken,
    { fields: "id,name,access_token" }
  );
  return data.data.map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token }));
}

// Đăng ký trang nhận Webhook "messages" của App (xem src/app/api/webhooks/facebook/route.ts)
// — bắt buộc thì mới có tin nhắn realtime, nếu không Facebook không tự đẩy sự kiện cho app.
// Gọi tự động ngay sau khi seller chọn trang ở OAuth callback, seller không cần biết khái
// niệm "webhook" là gì. Lỗi ở đây không nên chặn cả flow kết nối — trang vẫn dùng được (chỉ
// mất phần realtime, còn nút "Làm mới"/backfill vẫn hoạt động), nên bọc try/catch ở nơi gọi.
export async function subscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  await graphPost(`/${pageId}/subscribed_apps`, pageAccessToken, { subscribed_fields: "messages" });
}

// Kiểm tra lại trang ĐÃ THỰC SỰ được đăng ký nhận webhook chưa — subscribePageWebhook() ở trên
// gọi tự động lúc kết nối nhưng bọc try/catch nuốt lỗi ở nơi gọi (không chặn flow kết nối),
// nên seller không có cách nào tự biết nó có thành công hay không nếu chỉ nhìn UI. Dùng hàm
// này để hiển thị trạng thái thật + cho phép "Đăng ký lại" khi cần (xem
// FacebookInboxPanel.tsx).
export async function isPageSubscribedToWebhook(pageId: string, pageAccessToken: string): Promise<boolean> {
  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) return false;
  try {
    const data = await graphFetch<{ data: Array<{ id: string }> }>(`/${pageId}/subscribed_apps`, pageAccessToken, {});
    return data.data.some((app) => app.id === appId);
  } catch {
    return false;
  }
}

export type FbConversation = {
  id: string;
  updatedAt: string;
  snippet: string | null;
  participantName: string | null;
  participantPsid: string | null;
  avatarUrl: string | null;
};

export type FbConversationListResponse = { data: FbConversation[] };

type RawConversation = {
  id: string;
  updated_time: string;
  snippet?: string;
  participants?: { data: Array<{ id: string; name?: string }> };
};

function mapConversation(pageId: string, c: RawConversation): Omit<FbConversation, "avatarUrl"> {
  const other = c.participants?.data.find((p) => p.id !== pageId);
  return {
    id: c.id,
    updatedAt: c.updated_time,
    snippet: c.snippet ?? null,
    participantName: other?.name ?? null,
    participantPsid: other?.id ?? null,
  };
}

// Conversations API không trả ảnh đại diện qua participants{} — cách chính thức để lấy avatar
// của người nhắn (Page-scoped ID) là gọi riêng /{psid}?fields=profile_pic bằng Page Access
// Token. Trả về null thay vì ném lỗi khi thất bại (vd. do giới hạn Advanced Access) để 1 avatar
// lỗi không làm hỏng cả danh sách hội thoại.
async function getParticipantAvatar(psid: string, pageAccessToken: string): Promise<string | null> {
  try {
    const data = await graphFetch<{ profile_pic?: string }>(`/${psid}`, pageAccessToken, { fields: "profile_pic" });
    return data.profile_pic ?? null;
  } catch {
    return null;
  }
}

export type ParticipantProfile = { name: string | null; avatarUrl: string | null };

// Webhook chỉ báo PSID của khách, không kèm tên/ảnh — dùng hàm này để tra tên+avatar 1 lần khi
// gặp khách mới (cache lại ở FacebookParticipant, xem facebook-inbox.ts), tránh phải gọi lại
// Graph API mỗi lần hiển thị.
export async function fetchParticipantProfile(psid: string, pageAccessToken: string): Promise<ParticipantProfile> {
  try {
    const data = await graphFetch<{ name?: string; profile_pic?: string }>(`/${psid}`, pageAccessToken, {
      fields: "name,profile_pic",
    });
    return { name: data.name ?? null, avatarUrl: data.profile_pic ?? null };
  } catch {
    return { name: null, avatarUrl: null };
  }
}

// participants trả về CẢ page lẫn người nhắn — lọc bỏ chính page để lấy đúng tên/PSID người
// nhắn (dùng PSID này làm recipient.id khi gửi trả lời qua Send API).
//
// folder mặc định của Graph API là "inbox" — tin nhắn ĐẦU TIÊN của một người lạ chưa từng
// nhắn cho page thường bị Facebook xếp vào folder "other" (tương đương "Yêu cầu tin nhắn"
// trên giao diện Facebook), KHÔNG xuất hiện nếu chỉ gọi folder mặc định. Facebook chỉ tự
// chuyển hội thoại đó sang "inbox" sau khi page trả lời — đây là lý do tin nhắn khách gửi
// trước không hiện cho tới khi seller nhắn lại. Gọi cả 2 folder rồi gộp để không bỏ sót.
export async function listConversations(pageId: string, pageAccessToken: string): Promise<FbConversation[]> {
  const [inbox, other] = await Promise.all(
    (["inbox", "other"] as const).map((folder) =>
      graphFetch<{ data: RawConversation[] }>(`/${pageId}/conversations`, pageAccessToken, {
        platform: "messenger",
        folder,
        fields: "participants,snippet,updated_time",
        limit: "50",
      })
    )
  );

  const byId = new Map<string, Omit<FbConversation, "avatarUrl">>();
  for (const c of [...inbox.data, ...other.data]) {
    byId.set(c.id, mapConversation(pageId, c));
  }
  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const uniquePsids = [...new Set(merged.map((c) => c.participantPsid).filter((id): id is string => id !== null))];
  const avatarEntries = await Promise.all(
    uniquePsids.map(async (psid) => [psid, await getParticipantAvatar(psid, pageAccessToken)] as const)
  );
  const avatarByPsid = new Map(avatarEntries);

  return merged.map((c) => ({
    ...c,
    avatarUrl: c.participantPsid ? (avatarByPsid.get(c.participantPsid) ?? null) : null,
  }));
}

export type FbAttachmentType = "IMAGE" | "VIDEO" | "AUDIO" | "FILE";

export type FbMessage = {
  id: string;
  message: string;
  fromId: string | null;
  fromName: string | null;
  createdAt: string;
  attachmentType: FbAttachmentType | null;
  attachmentUrl: string | null;
};

// Tin nhắn sticker/ảnh/voice/video không có field "message" (rỗng) — dùng làm chú thích dự
// phòng khi chỗ hiển thị chưa/không render được attachment thật (vd. snippet ở danh sách hội
// thoại) — bong bóng chat chính giờ đã hiển thị ảnh/video/voice thật qua attachmentUrl.
function attachmentLabel(mimeType?: string): string {
  if (mimeType?.startsWith("image/")) return "🖼️ Đã gửi hình ảnh";
  if (mimeType?.startsWith("video/")) return "🎬 Đã gửi video";
  if (mimeType?.startsWith("audio/")) return "🎤 Đã gửi tin nhắn thoại";
  return "📎 Đã gửi tệp đính kèm — mở Facebook để xem";
}

function mapAttachmentType(mimeType?: string): FbAttachmentType {
  if (mimeType?.startsWith("image/")) return "IMAGE";
  if (mimeType?.startsWith("video/")) return "VIDEO";
  if (mimeType?.startsWith("audio/")) return "AUDIO";
  return "FILE";
}

export async function listMessages(conversationId: string, pageAccessToken: string): Promise<FbMessage[]> {
  const data = await graphFetch<{
    data: Array<{
      id: string;
      message?: string;
      from?: { id: string; name?: string };
      created_time: string;
      attachments?: {
        data: Array<{
          mime_type?: string;
          image_data?: { url?: string };
          video_data?: { url?: string };
          file_url?: string;
        }>;
      };
    }>;
  }>(`/${conversationId}/messages`, pageAccessToken, {
    fields: "message,from,created_time,attachments{mime_type,image_data,video_data,file_url}",
    limit: "50",
  });

  // Graph API trả tin mới nhất trước — đảo lại để hiển thị theo thứ tự thời gian tăng dần
  // giống mọi khung chat khác trong app (ChatWidget/AdminChatPanel).
  return data.data
    .map((m) => {
      const text = m.message?.trim();
      const att = m.attachments?.data?.[0];
      const attachmentUrl = att?.image_data?.url ?? att?.video_data?.url ?? att?.file_url ?? null;
      return {
        id: m.id,
        message: text ? text : attachmentLabel(att?.mime_type),
        fromId: m.from?.id ?? null,
        fromName: m.from?.name ?? null,
        createdAt: m.created_time,
        attachmentType: attachmentUrl ? mapAttachmentType(att?.mime_type) : null,
        attachmentUrl,
      };
    })
    .reverse();
}

// Gửi tin nhắn Messenger (Send API) — recipient là PSID người nhắn lấy từ
// participants ở listConversations, KHÔNG phải conversationId. Meta giới hạn: chỉ gửi được
// trong vòng 24h kể từ tin nhắn cuối của khách (24-hour messaging window), ngoài khung giờ
// đó Graph API tự trả lỗi rõ ràng — không có cách né ngoài dùng message tag hợp lệ.
// Trả về message_id do Facebook cấp — dùng làm khoá chính khi ghi lại tin nhắn này vào cache
// DB của app (FacebookMessage.id), để nếu về sau có bật thêm webhook field "messaging_echoes"
// thì việc upsert theo id vẫn tự khử trùng lặp, không hiện 2 lần.
export async function sendMessengerMessage(
  pageId: string,
  pageAccessToken: string,
  recipientPsid: string,
  text: string
): Promise<string> {
  const res = await graphPost<{ message_id: string }>(`/${pageId}/messages`, pageAccessToken, {
    recipient: JSON.stringify({ id: recipientPsid }),
    message: JSON.stringify({ text }),
    messaging_type: "RESPONSE",
  });
  return res.message_id;
}

export type FbComment = {
  id: string;
  message: string;
  fromName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  postMessage: string | null;
};

// Lấy bình luận từ các bài đăng gần nhất của trang (thay vì phải chọn từng bài) — đủ dùng
// cho việc theo dõi bình luận mới, không cần duyệt toàn bộ lịch sử bài đăng. `from{picture}` lấy
// luôn ảnh đại diện người bình luận — đây là dữ liệu công khai của bài đăng công khai (khác
// với avatar người nhắn Messenger ở trên), không bị giới hạn bởi Advanced Access.
export async function listRecentComments(pageId: string, pageAccessToken: string): Promise<FbComment[]> {
  const data = await graphFetch<{
    data: Array<{
      id: string;
      message?: string;
      created_time: string;
      comments?: {
        data: Array<{
          id: string;
          message: string;
          from?: { name?: string; picture?: { data?: { url?: string } } };
          created_time: string;
        }>;
      };
    }>;
  }>(`/${pageId}/feed`, pageAccessToken, {
    fields: "message,created_time,comments{message,from{name,picture},created_time}",
    limit: "20",
  });

  const comments: FbComment[] = [];
  for (const post of data.data) {
    for (const c of post.comments?.data ?? []) {
      comments.push({
        id: c.id,
        message: c.message,
        fromName: c.from?.name ?? null,
        avatarUrl: c.from?.picture?.data?.url ?? null,
        createdAt: c.created_time,
        postMessage: post.message ?? null,
      });
    }
  }
  // Mới nhất trước — khác chiều với tin nhắn Messenger vì bình luận hiển thị dạng feed đọc
  // từ trên xuống, không phải khung chat.
  return comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function replyToComment(commentId: string, pageAccessToken: string, text: string): Promise<void> {
  await graphPost(`/${commentId}/comments`, pageAccessToken, { message: text });
}

// --- Webhook realtime — xem src/app/api/webhooks/facebook/route.ts.

// Xác minh handshake lúc đăng ký Webhook trên Meta App Dashboard (Meta gọi GET với 3 query
// param này để kiểm tra server có đúng verify token đã cấu hình không, trước khi cho lưu URL).
export function verifyWebhookChallenge(mode: string | null, token: string | null, challenge: string | null): string | null {
  const expected = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  if (!expected || mode !== "subscribe" || token !== expected || !challenge) return null;
  return challenge;
}

// Meta ký MỌI request webhook bằng HMAC-SHA256 của App Secret lên phần body gốc (chưa parse
// JSON) — bắt buộc kiểm tra để chặn giả mạo request tới endpoint công khai này (ai cũng gọi
// được URL nếu không xác minh signature). Dùng timingSafeEqual thay vì so sánh chuỗi thường
// để không lộ thông tin qua thời gian so sánh (timing attack).
export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;

  const crypto = await import("crypto");
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
