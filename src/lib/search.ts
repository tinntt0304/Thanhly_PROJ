// Chuẩn hoá chuỗi để so khớp tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt
// (vd. "ban" khớp với "Bàn ăn dặm", "do choi" khớp "đồ chơi").
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function matchesSearch(title: string, query: string): boolean {
  const q = normalizeForSearch(query);
  if (q === "") return true;
  return normalizeForSearch(title).includes(q);
}
