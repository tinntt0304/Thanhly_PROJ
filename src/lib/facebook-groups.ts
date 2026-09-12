import { formatVND } from "@/lib/auction";

// Đấu nối actor Apify "easyapi/facebook-groups-search-scraper" — actor do người dùng tự
// chọn/trả phí trên Apify, không phải scraper tự viết. Input/output schema tham khảo trang
// actor trên Apify Store (apify.com/easyapi/facebook-groups-search-scraper).
// Đổi từ "scraper-engine/facebook-groups-search-scraper" (2026-09) vì actor đó đã bị GỠ KHỎI
// Apify Store (gọi API trả 404) — tính năng tìm nhóm bị hỏng hoàn toàn cho tới khi đổi actor.
// Khác biệt quan trọng so với actor cũ: actor mới chỉ nhận ĐÚNG 1 từ khóa/lượt gọi (input
// "searchQuery" kiểu string, không phải mảng "startUrls" như actor cũ) — xem vòng lặp gọi
// từng từ khóa ở runFacebookGroupsSearch() bên dưới. Actor mới cũng KHÔNG trả mô tả nhóm
// (không có field tương đương "groupDescription"), nên description luôn là null.
const ACTOR_ID = "easyapi~facebook-groups-search-scraper"; // "/" -> "~" theo quy ước URL của Apify

// Actor tính maxItems THEO TỪNG từ khóa (không phải tổng), nên giới hạn ở mức vừa phải
// để tránh tốn credit Apify ngoài ý muốn khi nhập nhiều từ khóa cùng lúc.
export const MAX_ITEMS_LIMIT = 100;
export const DEFAULT_MAX_ITEMS = 20;

// Từ khóa đã gọi Apify trong khoảng thời gian này thì lần tìm sau (nếu không tick
// "bắt buộc tìm lại") sẽ dùng lại kết quả đã lưu trong DB thay vì gọi lại API — tiết
// kiệm credit Apify cho các lượt tìm trùng từ khóa gần nhau.
export const SEARCH_CACHE_HOURS = 12;

// Khoảng cách tối thiểu giữa 2 lượt gọi Apify THẬT của cùng 1 tài khoản — chặn spam/DoS:
// không có giới hạn này thì 1 script gọi searchFacebookGroups liên tục vẫn được server xử
// lý y hệt client thật, có thể đốt credit Apify của cả sàn hoặc khiến Apify rate-limit
// luôn token, làm tính năng sập cho tất cả người dùng. Không áp dụng cho superadmin.
export const SEARCH_RATE_LIMIT_SECONDS = 20;

// Đặt ở đây (không phải file "use server") vì module Server Actions chỉ được phép
// export async function — export thêm 1 hằng số thường sẽ làm Next.js build lỗi
// "module has no exports at all".
export const SAVED_GROUPS_PAGE_SIZE = 50;

export type PromotableProduct = {
  id: string;
  title: string;
  price: number;
  url: string;
};

// Meta đã gỡ quyền publish_to_groups khỏi Graph API (từ 4/2024) — không còn API chính thức
// nào đăng thẳng vào nhóm Facebook được nữa, và mọi công cụ "tự động đăng nhóm" còn lại đều
// làm bằng cách giả lập phiên đăng nhập thật (vi phạm điều khoản Facebook, rủi ro khoá tài
// khoản). Vì vậy chỉ soạn sẵn nội dung để người dùng tự dán + tự bấm đăng (hành động thật của
// con người, không tự động hoá), xem GroupPromoteButton trong FacebookGroupsSearchPanel.tsx.
export function buildGroupPostCaption(product: PromotableProduct): string {
  return `🔥 ${product.title}\n💰 Giá: ${formatVND(product.price)}\n👉 Xem chi tiết & đặt mua: ${product.url}`;
}

export type FacebookGroupItem = {
  id: string;
  name: string;
  url: string;
  query: string | null;
  visibility: string | null;
  memberCount: number | null;
  postsPerDay: number | null;
  description: string | null;
};

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

// Actor Apify trả tên/mô tả nhóm lấy từ HTML gốc của Facebook, trong đó ký tự có dấu bị
// mã hoá thành HTML entity (vd. "ộ" -> "&#x1ed8;") thay vì Unicode thật — giải mã lại ở
// đây trước khi lưu DB, nếu không React sẽ hiện nguyên văn chuỗi entity ra màn hình.
function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_HTML_ENTITIES[entity] ?? match;
  });
}

// "21K members", "1.2M members", "530 members", "1,234 members" — actor trả số dạng chữ rút
// gọn (K/M/B) hoặc số có dấu phẩy ngăn cách hàng nghìn, không phải số thô. Bỏ dấu phẩy trước
// rồi mới bắt số + hậu tố, tránh nhầm dấu phẩy thành dấu thập phân.
function parseAbbreviatedCount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "");
  // KHÔNG cho \s* giữa số và hậu tố K/M/B — hậu tố (nếu có) luôn dính liền số ("21K"), có
  // khoảng trắng ở giữa nghĩa là chữ tiếp theo là "members" chứ không phải hậu tố (nếu không
  // chặn, "530 members" sẽ bị bắt nhầm chữ "m" trong "members" làm hậu tố Triệu = 530.000.000).
  const match = cleaned.match(/(\d+(?:\.\d+)?)([kmb])?\b/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
  return Math.round(value * multiplier);
}

function parseMemberCount(memberInfo: unknown): number | null {
  return typeof memberInfo === "string" ? parseAbbreviatedCount(memberInfo) : null;
}

// "4 posts a day", "10 posts a week", "2 posts a month" — quy đổi hết về số bài/ngày (đúng
// đơn vị field FacebookGroup.postsPerDay đang lưu) để so sánh được giữa các nhóm khác nhau
// dù actor trả về theo đơn vị thời gian khác nhau tuỳ mức độ hoạt động của nhóm.
function parsePostsPerDay(postFrequency: unknown): number | null {
  if (typeof postFrequency !== "string") return null;
  const match = postFrequency.match(/([\d]+(?:\.\d+)?)/);
  if (!match) return /no\s+recent\s+posts|inactive/i.test(postFrequency) ? 0 : null;
  const count = Number.parseFloat(match[1]);
  if (Number.isNaN(count)) return null;
  if (/week/i.test(postFrequency)) return count / 7;
  if (/month/i.test(postFrequency)) return count / 30;
  if (/year/i.test(postFrequency)) return count / 365;
  return count;
}

function normalizeItem(item: unknown, query: string): FacebookGroupItem {
  const o = (item ?? {}) as Record<string, unknown>;
  const name = typeof o.name === "string" && o.name.trim() ? o.name : "(Không có tên)";
  return {
    id: typeof o.id === "string" ? o.id : "",
    name: decodeHtmlEntities(name),
    url: typeof o.url === "string" ? o.url : "",
    query,
    visibility: typeof o.visibility === "string" ? o.visibility : null,
    memberCount: parseMemberCount(o.memberInfo),
    postsPerDay: parsePostsPerDay(o.postFrequency),
    // Actor này không trả mô tả nhóm (không có field tương đương) — xem ghi chú ở ACTOR_ID.
    description: null,
  };
}

async function runSearchForKeyword(token: string, keyword: string, maxItems: number): Promise<FacebookGroupItem[]> {
  let res: Response;
  try {
    res = await fetch(`https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?timeout=120`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ searchQuery: keyword, maxItems }),
    });
  } catch {
    throw new Error("Không kết nối được tới Apify — kiểm tra mạng và thử lại.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("APIFY_API_TOKEN không hợp lệ hoặc hết quyền truy cập actor.");
    }
    throw new Error(`Apify trả lỗi (${res.status}) cho từ khóa "${keyword}": ${text.slice(0, 200) || "không rõ nguyên nhân"}`);
  }

  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) return [];

  return raw.map((entry) => normalizeItem(entry, keyword));
}

// Actor "easyapi/facebook-groups-search-scraper" chỉ nhận 1 từ khóa/lượt gọi (khác actor cũ
// nhận cả mảng trong 1 lượt) — gọi TUẦN TỰ từng từ khóa, dừng ngay (throw) nếu 1 từ khóa lỗi
// thay vì bỏ qua: mỗi lượt gọi tốn credit Apify thật của sàn, nhưng chỉ trừ credit người bán
// SAU KHI có đủ kết quả (xem chargeForSearch ở actions/facebook-groups.ts) — nếu âm thầm bỏ
// qua từ khóa lỗi, người bán trả tiền cho kết quả thiếu mà không biết vì sao.
export async function runFacebookGroupsSearch(
  keywords: string[],
  maxItems: number
): Promise<FacebookGroupItem[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("Chưa cấu hình APIFY_API_TOKEN trên server — thêm vào .env rồi thử lại.");
  }

  const results: FacebookGroupItem[] = [];
  for (const keyword of keywords) {
    results.push(...(await runSearchForKeyword(token, keyword, maxItems)));
  }
  return results;
}
