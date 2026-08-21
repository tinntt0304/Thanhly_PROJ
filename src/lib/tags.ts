export const TAG_VALUES = ["FEATURED", "HOT_DEAL"] as const;
export type ProductTag = (typeof TAG_VALUES)[number];

export const TAG_LABEL: Record<ProductTag, string> = {
  FEATURED: "Nổi bật",
  HOT_DEAL: "Hot Deal",
};

export const TAG_STYLE: Record<ProductTag, string> = {
  FEATURED: "bg-accent-2-600 text-white",
  HOT_DEAL: "bg-accent-500 text-white",
};

export function isProductTag(value: string): value is ProductTag {
  return (TAG_VALUES as readonly string[]).includes(value);
}

export function asProductTags(values: string[]): ProductTag[] {
  return values.filter(isProductTag);
}
