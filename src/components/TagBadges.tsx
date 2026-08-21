import { asProductTags, TAG_ICON, TAG_LABEL, TAG_STYLE } from "@/lib/tags";

export function TagBadges({ tags, className = "" }: { tags: string[]; className?: string }) {
  const validTags = asProductTags(tags);
  if (validTags.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {validTags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-extrabold uppercase tracking-wide shadow-md ${TAG_STYLE[tag]}`}
        >
          <span aria-hidden="true">{TAG_ICON[tag]}</span>
          {TAG_LABEL[tag]}
        </span>
      ))}
    </div>
  );
}
