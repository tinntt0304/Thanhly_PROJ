export type Review = { author: string; text: string };

// Mỗi dòng textarea có định dạng "Tên khách | Nội dung review"
export function parseReviews(text: string): Review[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [author, ...rest] = line.split("|");
      return {
        author: author?.trim() || "Khách hàng",
        text: rest.join("|").trim(),
      };
    })
    .filter((r) => r.text.length > 0);
}

export function reviewsToText(reviews: Review[]): string {
  return reviews.map((r) => `${r.author} | ${r.text}`).join("\n");
}
