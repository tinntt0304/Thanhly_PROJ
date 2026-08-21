import { asProductTags, TAG_LABEL, TAG_STYLE } from "@/lib/tags";

export function TagBadges({ tags, className = "" }: { tags: string[]; className?: string }) {
  const validTags = asProductTags(tags);
  if (validTags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {validTags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TAG_STYLE[tag]}`}
        >
          {TAG_LABEL[tag]}
        </span>
      ))}
    </div>
  );
}
