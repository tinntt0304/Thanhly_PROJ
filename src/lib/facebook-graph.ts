// Đấu nối Meta Graph API (https://developers.facebook.com/docs/graph-api) để lấy hội thoại
// Messenger + bình luận bài đăng của 1 fanpage, và trả lời trực tiếp — dùng ở
// /admin/hop-thu-facebook. Mỗi seller tự tạo Page Access Token của trang mình (không có flow
// OAuth "Đăng nhập bằng Facebook" ở app này) — token cần các quyền: pages_show_list,
// pages_read_engagement, pages_manage_metadata (đọc), pages_messaging (đọc/gửi tin nhắn
// Messenger), pages_manage_engagement (trả lời bình luận). Các quyền nhạy cảm này Meta yêu
// cầu App Review mới dùng được cho page ngoài danh sách tester — nếu token thiếu quyền, Graph
// API trả lỗi rõ ràng (xem graphError) thay vì crash trang.

const GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

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

// Xác thực Page ID + token khớp nhau và lấy tên trang hiển thị — gọi lúc kết nối để báo lỗi
// ngay nếu token sai/hết hạn, thay vì để tới lúc tải hội thoại mới phát hiện.
export async function verifyPageToken(pageId: string, pageAccessToken: string): Promise<{ name: string }> {
  const data = await graphFetch<{ id: string; name: string }>(`/${pageId}`, pageAccessToken, { fields: "id,name" });
  return { name: data.name };
}

export type FbConversation = {
  id: string;
  updatedAt: string;
  snippet: string | null;
  participantName: string | null;
  participantPsid: string | null;
};

export type FbConversationListResponse = { data: FbConversation[] };

// participants trả về CẢ page lẫn người nhắn — lọc bỏ chính page để lấy đúng tên/PSID người
// nhắn (dùng PSID này làm recipient.id khi gửi trả lời qua Send API).
export async function listConversations(pageId: string, pageAccessToken: string): Promise<FbConversation[]> {
  const data = await graphFetch<{
    data: Array<{
      id: string;
      updated_time: string;
      snippet?: string;
      participants?: { data: Array<{ id: string; name?: string }> };
    }>;
  }>(`/${pageId}/conversations`, pageAccessToken, {
    platform: "messenger",
    fields: "participants,snippet,updated_time",
    limit: "50",
  });

  return data.data.map((c) => {
    const other = c.participants?.data.find((p) => p.id !== pageId);
    return {
      id: c.id,
      updatedAt: c.updated_time,
      snippet: c.snippet ?? null,
      participantName: other?.name ?? null,
      participantPsid: other?.id ?? null,
    };
  });
}

export type FbMessage = {
  id: string;
  message: string | null;
  fromId: string | null;
  fromName: string | null;
  createdAt: string;
};

export async function listMessages(conversationId: string, pageAccessToken: string): Promise<FbMessage[]> {
  const data = await graphFetch<{
    data: Array<{ id: string; message?: string; from?: { id: string; name?: string }; created_time: string }>;
  }>(`/${conversationId}/messages`, pageAccessToken, {
    fields: "message,from,created_time",
    limit: "50",
  });

  // Graph API trả tin mới nhất trước — đảo lại để hiển thị theo thứ tự thời gian tăng dần
  // giống mọi khung chat khác trong app (ChatWidget/AdminChatPanel).
  return data.data
    .map((m) => ({
      id: m.id,
      message: m.message ?? null,
      fromId: m.from?.id ?? null,
      fromName: m.from?.name ?? null,
      createdAt: m.created_time,
    }))
    .reverse();
}

// Gửi tin nhắn Messenger (Send API) — recipient là PSID người nhắn lấy từ
// participants ở listConversations, KHÔNG phải conversationId. Meta giới hạn: chỉ gửi được
// trong vòng 24h kể từ tin nhắn cuối của khách (24-hour messaging window), ngoài khung giờ
// đó Graph API tự trả lỗi rõ ràng — không có cách né ngoài dùng message tag hợp lệ.
export async function sendMessengerMessage(
  pageId: string,
  pageAccessToken: string,
  recipientPsid: string,
  text: string
): Promise<void> {
  await graphPost(`/${pageId}/messages`, pageAccessToken, {
    recipient: JSON.stringify({ id: recipientPsid }),
    message: JSON.stringify({ text }),
    messaging_type: "RESPONSE",
  });
}

export type FbComment = {
  id: string;
  message: string;
  fromName: string | null;
  createdAt: string;
  postMessage: string | null;
};

// Lấy bình luận từ các bài đăng gần nhất của trang (thay vì phải chọn từng bài) — đủ dùng
// cho việc theo dõi bình luận mới, không cần duyệt toàn bộ lịch sử bài đăng.
export async function listRecentComments(pageId: string, pageAccessToken: string): Promise<FbComment[]> {
  const data = await graphFetch<{
    data: Array<{
      id: string;
      message?: string;
      created_time: string;
      comments?: {
        data: Array<{ id: string; message: string; from?: { name?: string }; created_time: string }>;
      };
    }>;
  }>(`/${pageId}/feed`, pageAccessToken, {
    fields: "message,created_time,comments{message,from,created_time}",
    limit: "20",
  });

  const comments: FbComment[] = [];
  for (const post of data.data) {
    for (const c of post.comments?.data ?? []) {
      comments.push({
        id: c.id,
        message: c.message,
        fromName: c.from?.name ?? null,
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
