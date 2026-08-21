export const TAG_VALUES = ["FEATURED", "HOT_DEAL"] as const;
export type ProductTag = (typeof TAG_VALUES)[number];

export const TAG_LABEL: Record<ProductTag, string> = {
  FEATURED: "Nổi bật",
  HOT_DEAL: "Hot Deal",
};

export const TAG_ICON: Record<ProductTag, string> = {
  FEATURED: "⭐",
  HOT_DEAL: "🔥",
};

// Gradient + xoay nhẹ để có cảm giác "sticker" dán lên ảnh, không phải badge phẳng.
export const TAG_STYLE: Record<ProductTag, string> = {
  FEATURED:
    "bg-gradient-to-br from-gold-300 to-gold-600 text-neutral-900 -rotate-3 ring-1 ring-white/60",
  HOT_DEAL: "bg-gradient-to-br from-hot-400 to-hot-600 text-white rotate-2 ring-1 ring-white/40",
};

export function isProductTag(value: string): value is ProductTag {
  return (TAG_VALUES as readonly string[]).includes(value);
}

export function asProductTags(values: string[]): ProductTag[] {
  return values.filter(isProductTag);
}
