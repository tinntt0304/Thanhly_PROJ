// Đấu nối actor Apify "scraper-engine/facebook-groups-search-scraper" — actor do
// người dùng tự chọn/trả phí trên Apify, không phải scraper tự viết. Input/output
// schema tham khảo trang actor trên Apify Store (apify.com/scraper-engine/
// facebook-groups-search-scraper).
const ACTOR_ID = "scraper-engine~facebook-groups-search-scraper"; // "/" -> "~" theo quy ước URL của Apify

// Actor tính maxItems THEO TỪNG từ khóa (không phải tổng), nên giới hạn ở mức vừa phải
// để tránh tốn credit Apify ngoài ý muốn khi nhập nhiều từ khóa cùng lúc.
export const MAX_ITEMS_LIMIT = 100;
export const DEFAULT_MAX_ITEMS = 20;

// Từ khóa đã gọi Apify trong khoảng thời gian này thì lần tìm sau (nếu không tick
// "bắt buộc tìm lại") sẽ dùng lại kết quả đã lưu trong DB thay vì gọi lại API — tiết
// kiệm credit Apify cho các lượt tìm trùng từ khóa gần nhau.
export const SEARCH_CACHE_HOURS = 12;

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

function normalizeItem(item: unknown): FacebookGroupItem {
  const o = (item ?? {}) as Record<string, unknown>;
  return {
    id: typeof o.id === "string" ? o.id : "",
    name: typeof o.name === "string" && o.name.trim() ? o.name : "(Không có tên)",
    url: typeof o.url === "string" ? o.url : "",
    query: typeof o.query === "string" ? o.query : null,
    visibility: typeof o.visibility === "string" ? o.visibility : null,
    memberCount: typeof o.memberCountNumeric === "number" ? o.memberCountNumeric : null,
    postsPerDay: typeof o.postsPerDayNumeric === "number" ? o.postsPerDayNumeric : null,
    description: typeof o.groupDescription === "string" ? o.groupDescription : null,
  };
}

export async function runFacebookGroupsSearch(
  keywords: string[],
  maxItems: number
): Promise<FacebookGroupItem[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error("Chưa cấu hình APIFY_API_TOKEN trên server — thêm vào .env rồi thử lại.");
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?timeout=120`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startUrls: keywords, maxItems }),
      }
    );
  } catch {
    throw new Error("Không kết nối được tới Apify — kiểm tra mạng và thử lại.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("APIFY_API_TOKEN không hợp lệ hoặc hết quyền truy cập actor.");
    }
    throw new Error(`Apify trả lỗi (${res.status}): ${text.slice(0, 200) || "không rõ nguyên nhân"}`);
  }

  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) return [];

  return raw.map(normalizeItem);
}
