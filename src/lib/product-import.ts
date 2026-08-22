import ExcelJS from "exceljs";
import { toDateTimeLocal } from "@/lib/datetime";
import { normalizeForSearch } from "@/lib/search";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/product-limits";
import type { Attribute } from "@/lib/attributes";
import { TAG_LABEL, TAG_VALUES, type ProductTag } from "@/lib/tags";

// Các cột trong file Excel import — cùng field với form đăng sản phẩm thủ công
// (ProductForm.tsx), nhưng gộp thuộc tính/nhãn/ảnh thành text 1 dòng vì Excel không có
// UI chip/tag. Không đổi tên `label` nếu không muốn phá vỡ file mẫu người dùng đã tải.
export const IMPORT_COLUMNS: { key: keyof ImportRowInput; label: string; width: number }[] = [
  { key: "title", label: "Tên sản phẩm", width: 28 },
  { key: "description", label: "Mô tả", width: 36 },
  { key: "condition", label: "Tình trạng", width: 22 },
  { key: "quantity", label: "Số lượng", width: 10 },
  { key: "startPrice", label: "Giá khởi điểm (đ)", width: 16 },
  { key: "minBidStep", label: "Bước giá tối thiểu (đ)", width: 18 },
  { key: "buyNowPrice", label: "Giá mua ngay (đ)", width: 16 },
  { key: "endTime", label: "Thời gian kết thúc (yyyy-mm-dd hh:mm)", width: 26 },
  { key: "images", label: "Ảnh (URL, cách nhau bởi dấu phẩy)", width: 42 },
  { key: "attributesText", label: "Thuộc tính (Tên: giá trị 1, giá trị 2; Tên khác: giá trị)", width: 44 },
  { key: "tagsText", label: "Nhãn (Nổi bật, Hot Deal)", width: 20 },
];

export type ImportRowInput = {
  title: string;
  description: string;
  condition: string;
  quantity: string;
  startPrice: string;
  minBidStep: string;
  buyNowPrice: string;
  endTime: string;
  images: string;
  attributesText: string;
  tagsText: string;
};

export type ProductCreateData = {
  title: string;
  description: string;
  condition: string;
  quantity: number;
  images: string[];
  attributes: Attribute[];
  tags: ProductTag[];
  startPrice: number;
  minBidStep: number;
  currentPrice: number;
  buyNowPrice: number | null;
  endTime: Date;
};

// "Tên: giá trị 1, giá trị 2; Tên khác: giá trị" -> [{name, values}] — cùng cú pháp
// nhiều-giá-trị-mỗi-thuộc-tính như UI chip trong ProductForm, chỉ khác cách gõ vì Excel
// là text thuần.
export function parseAttributesText(text: string): Attribute[] {
  return text
    .split(";")
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group): Attribute | null => {
      const idx = group.indexOf(":");
      if (idx === -1) return null;
      const name = group.slice(0, idx).trim();
      const values = group
        .slice(idx + 1)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (!name || values.length === 0) return null;
      return { name, values };
    })
    .filter((a): a is Attribute => a !== null);
}

// Chấp nhận cả nhãn tiếng Việt ("Nổi bật", "Hot Deal") lẫn mã enum (FEATURED, HOT_DEAL),
// không phân biệt hoa/thường/dấu — token không khớp bị bỏ qua thay vì báo lỗi, vì nhãn
// chỉ là trang trí, không đáng để chặn cả dòng import.
export function parseTagsText(text: string): ProductTag[] {
  const tokens = text
    .split(",")
    .map((t) => normalizeForSearch(t))
    .filter(Boolean);

  const result: ProductTag[] = [];
  for (const token of tokens) {
    const match = TAG_VALUES.find(
      (tag) => normalizeForSearch(TAG_LABEL[tag]) === token || tag.toLowerCase() === token.replace(/\s+/g, "_")
    );
    if (match && !result.includes(match)) result.push(match);
  }
  return result;
}

function splitImages(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateImportRow(
  input: ImportRowInput
): { ok: true; data: ProductCreateData } | { ok: false; error: string } {
  const errors: string[] = [];

  const title = input.title.trim();
  if (!title) errors.push("Thiếu tên sản phẩm");

  const description = input.description.trim();
  if (!description) errors.push("Thiếu mô tả");

  const condition = input.condition.trim();
  if (!condition) errors.push("Thiếu tình trạng");

  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    errors.push("Số lượng phải là số nguyên dương");
  }

  const startPrice = Number(input.startPrice);
  if (!Number.isInteger(startPrice) || startPrice <= 0) {
    errors.push("Giá khởi điểm phải là số nguyên dương");
  }

  const minBidStep = Number(input.minBidStep);
  if (!Number.isInteger(minBidStep) || minBidStep <= 0) {
    errors.push("Bước giá tối thiểu phải là số nguyên dương");
  }

  let buyNowPrice: number | null = null;
  const buyNowRaw = input.buyNowPrice.trim();
  if (buyNowRaw !== "") {
    const n = Number(buyNowRaw);
    if (!Number.isInteger(n) || n <= 0) {
      errors.push("Giá mua ngay không hợp lệ");
    } else if (Number.isInteger(startPrice) && n <= startPrice) {
      errors.push("Giá mua ngay phải cao hơn giá khởi điểm");
    } else {
      buyNowPrice = n;
    }
  }

  let endTime: Date | null = null;
  const endTimeRaw = input.endTime.trim();
  if (!endTimeRaw) {
    errors.push("Thiếu thời gian kết thúc");
  } else {
    const d = new Date(endTimeRaw.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) {
      errors.push("Thời gian kết thúc không hợp lệ (định dạng: yyyy-mm-dd hh:mm)");
    } else if (d.getTime() <= Date.now()) {
      errors.push("Thời gian kết thúc phải ở tương lai");
    } else {
      endTime = d;
    }
  }

  const images = splitImages(input.images);
  if (images.length === 0) errors.push("Cần ít nhất 1 ảnh (URL)");
  if (images.length > MAX_IMAGES_PER_PRODUCT) {
    errors.push(`Chỉ được tối đa ${MAX_IMAGES_PER_PRODUCT} ảnh`);
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join("; ") };
  }

  return {
    ok: true,
    data: {
      title,
      description,
      condition,
      quantity,
      images,
      attributes: parseAttributesText(input.attributesText),
      tags: parseTagsText(input.tagsText),
      startPrice,
      minBidStep,
      currentPrice: startPrice,
      buyNowPrice,
      endTime: endTime as Date,
    },
  };
}

export async function buildImportTemplateBuffer(): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sản phẩm");

  sheet.columns = IMPORT_COLUMNS.map((c) => ({ header: c.label, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };

  sheet.addRow({
    title: "Nồi cơm điện Panasonic 1.8L",
    description: "Nồi cơm điện còn khoảng 90% mới, đủ phụ kiện, không lỗi.",
    condition: "Đã dùng - còn tốt",
    quantity: 1,
    startPrice: 300000,
    minBidStep: 20000,
    buyNowPrice: "",
    endTime: "2026-09-01 20:00",
    images: "https://example.com/anh1.jpg, https://example.com/anh2.jpg",
    attributesText: "Thương hiệu: Panasonic; Dung tích: 1.8L; Màu sắc: Trắng, Xám",
    tagsText: "Nổi bật",
  } satisfies Record<keyof ImportRowInput, string | number>);

  const guide = workbook.addWorksheet("Hướng dẫn");
  guide.getColumn(1).width = 100;
  const lines = [
    "Hướng dẫn nhập liệu",
    "",
    "- Không đổi tên các cột ở dòng tiêu đề của sheet \"Sản phẩm\".",
    "- Xoá hoặc ghi đè dòng ví dụ (dòng 2) trước khi nhập dữ liệu thật.",
    "- Ảnh: dán URL ảnh, nhiều ảnh cách nhau bởi dấu phẩy. Ảnh đầu tiên là ảnh đại diện. Tối đa 8 ảnh, bắt buộc ít nhất 1 ảnh.",
    "- Thuộc tính: theo mẫu \"Tên: giá trị 1, giá trị 2; Tên khác: giá trị\". Có thể để trống.",
    "- Nhãn: \"Nổi bật\" và/hoặc \"Hot Deal\", cách nhau dấu phẩy. Có thể để trống.",
    "- Thời gian kết thúc: định dạng yyyy-mm-dd hh:mm (ví dụ 2026-09-01 20:00), phải ở tương lai.",
    "- Giá mua ngay: có thể để trống nếu không dùng, phải cao hơn giá khởi điểm nếu có.",
    "- Sau khi import, những dòng bị lỗi có thể sửa và \"Thử lại\" ngay trên trang, không cần tải lại file.",
  ];
  lines.forEach((line, i) => {
    guide.getCell(`A${i + 1}`).value = line;
  });
  guide.getCell("A1").font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  // exceljs kéo theo @types/node phiên bản khác (qua fast-csv) khiến type Buffer trả về
  // không khớp cấu trúc với Buffer của dự án dù cùng dữ liệu lúc chạy — trả về
  // Uint8Array (không có version) để tránh xung đột type.
  return new Uint8Array(buffer as unknown as ArrayLike<number>);
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((t) => t.text).join("");
    }
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
    if ("hyperlink" in value) return String(value.hyperlink ?? "");
    return "";
  }
  return String(value);
}

function getFieldText(
  row: ExcelJS.Row,
  colIndexByKey: Map<keyof ImportRowInput, number>,
  key: keyof ImportRowInput
): string {
  const idx = colIndexByKey.get(key);
  if (!idx) return "";
  const raw = row.getCell(idx).value;
  if (key === "endTime" && raw instanceof Date) {
    return toDateTimeLocal(raw);
  }
  return cellToText(raw).trim();
}

export async function parseImportFile(buffer: Buffer): Promise<ImportRowInput[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs kéo theo @types/node phiên bản khác (qua fast-csv) khai báo type `Buffer`
  // toàn cục không tương thích cấu trúc với Buffer của dự án dù cùng dữ liệu lúc chạy —
  // ép kiểu theo đúng type tham số của chính hàm load() để tránh xung đột.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const colIndexByKey = new Map<keyof ImportRowInput, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const text = normalizeForSearch(cellToText(cell.value));
    const match = IMPORT_COLUMNS.find((c) => normalizeForSearch(c.label) === text);
    if (match) colIndexByKey.set(match.key, colNumber);
  });

  const rows: ImportRowInput[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({
      title: getFieldText(row, colIndexByKey, "title"),
      description: getFieldText(row, colIndexByKey, "description"),
      condition: getFieldText(row, colIndexByKey, "condition"),
      quantity: getFieldText(row, colIndexByKey, "quantity"),
      startPrice: getFieldText(row, colIndexByKey, "startPrice"),
      minBidStep: getFieldText(row, colIndexByKey, "minBidStep"),
      buyNowPrice: getFieldText(row, colIndexByKey, "buyNowPrice"),
      endTime: getFieldText(row, colIndexByKey, "endTime"),
      images: getFieldText(row, colIndexByKey, "images"),
      attributesText: getFieldText(row, colIndexByKey, "attributesText"),
      tagsText: getFieldText(row, colIndexByKey, "tagsText"),
    });
  });

  return rows;
}
