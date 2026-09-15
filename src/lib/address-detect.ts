import { normalizeForSearch } from "@/lib/search";

// Đoán tỉnh/quận/phường từ 1 chuỗi địa chỉ tự do (vd "35 đồng đen, phường 12, tân bình") để
// tự chọn sẵn 3 select ở AddressPicker.tsx — người dùng thường gõ tắt/bỏ tiền tố hành chính
// ("Quận", "Phường", "Tỉnh"...) nên phải chuẩn hoá cả 2 phía (tên GHN trả về VÀ địa chỉ gõ
// tay) trước khi so khớp.

const PROVINCE_LEVEL_PREFIXES = ["thanh pho", "tinh"];
const DISTRICT_LEVEL_PREFIXES = ["quan", "huyen", "thi xa", "thanh pho"];
const WARD_LEVEL_PREFIXES = ["phuong", "xa", "thi tran"];

const DISTRICT_SHORT_PREFIXES = ["quan", "q", "huyen", "h"];
const WARD_SHORT_PREFIXES = ["phuong", "p", "xa", "x"];

// Vài tỉnh/thành hay được gọi tắt/gọi khác hẳn tên hành chính — bổ sung thủ công thay vì kỳ
// vọng đoán được mọi biến thể viết tắt có thể có.
const PROVINCE_ALIASES: [string, string[]][] = [
  ["ho chi minh", ["tp hcm", "tphcm", "hcm", "sai gon", "tp.hcm"]],
  ["ha noi", ["tp ha noi", "hn"]],
];

export const ADDRESS_LEVEL_PREFIXES = {
  province: PROVINCE_LEVEL_PREFIXES,
  district: DISTRICT_LEVEL_PREFIXES,
  ward: WARD_LEVEL_PREFIXES,
};

export const ADDRESS_SHORT_PREFIXES = {
  province: [] as string[],
  district: DISTRICT_SHORT_PREFIXES,
  ward: WARD_SHORT_PREFIXES,
};

export function normalizeAddressText(text: string): string {
  return normalizeForSearch(text);
}

function stripLevelPrefix(normalized: string, prefixes: string[]): string {
  for (const p of prefixes) {
    if (normalized.startsWith(`${p} `)) return normalized.slice(p.length + 1).trim();
  }
  return normalized;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// true nếu `needle` xuất hiện trong `haystack` đúng như 1 cụm từ riêng — không phải 1 chuỗi
// con nằm giữa từ khác (vd "an" không được khớp nhầm vào giữa "loan").
function containsPhrase(haystack: string, needle: string): boolean {
  if (needle.length < 3) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}($|[^a-z0-9])`);
  return pattern.test(` ${haystack} `);
}

// Tên hành chính dạng số (vd "Quận 1", "Phường 12") phải khớp NGHIÊM NGẶT hơn — chỉ chấp
// nhận khi có tiền tố ("quận"/"q"/"phường"/"p"...) đứng NGAY TRƯỚC số đó, tránh khớp nhầm số
// nhà/số đường (vd "35 Đồng Đen" không được khớp nhầm thành "Phường 35").
function containsNumberedLevel(haystack: string, num: string, shortPrefixes: string[]): boolean {
  if (shortPrefixes.length === 0) return false;
  const alt = shortPrefixes.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(^|[^a-z0-9])(${alt})\\.?\\s*${num}($|[^a-z0-9])`);
  return pattern.test(` ${haystack} `);
}

// Tìm ứng viên khớp nhất trong 1 danh sách (tỉnh/quận/phường) — ưu tiên tên (đã bỏ tiền tố)
// DÀI NHẤT khi có nhiều khớp, tránh khớp nhầm tên ngắn/chung chung nằm bên trong tên dài hơn.
export function findBestAddressMatch<T>(
  addressTextNormalized: string,
  candidates: T[],
  getName: (item: T) => string,
  levelPrefixes: string[],
  shortPrefixes: string[],
  aliases: [string, string[]][] = []
): T | null {
  let best: T | null = null;
  let bestScore = 0;

  for (const item of candidates) {
    const normalizedName = normalizeForSearch(getName(item));
    const stripped = stripLevelPrefix(normalizedName, levelPrefixes);
    const isNumbered = /^\d+$/.test(stripped);

    let matched: boolean;
    if (isNumbered) {
      matched = containsNumberedLevel(addressTextNormalized, stripped, shortPrefixes);
    } else if (stripped.length >= 3) {
      matched = containsPhrase(addressTextNormalized, stripped);
      if (!matched) {
        const aliasList = aliases.find(([canonical]) => canonical === stripped)?.[1] ?? [];
        matched = aliasList.some((a) => containsPhrase(addressTextNormalized, a));
      }
    } else {
      matched = false;
    }

    if (matched && stripped.length > bestScore) {
      best = item;
      bestScore = stripped.length;
    }
  }

  return best;
}

export const PROVINCE_ALIASES_LIST = PROVINCE_ALIASES;
