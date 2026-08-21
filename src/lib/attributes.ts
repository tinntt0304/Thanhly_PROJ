export type Attribute = { name: string; values: string[] };

// Chấp nhận cả dữ liệu cũ (dạng { name, value: string } trước khi đổi sang nhiều giá
// trị) lẫn dạng mới ({ name, values: string[] }) — chuẩn hoá về values: string[].
export function asAttributes(value: unknown): Attribute[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v): Attribute | null => {
      if (typeof v !== "object" || v === null) return null;
      const name = (v as { name?: unknown }).name;
      if (typeof name !== "string") return null;

      const rawValues = (v as { values?: unknown }).values;
      const legacyValue = (v as { value?: unknown }).value;

      let values: string[];
      if (Array.isArray(rawValues)) {
        values = rawValues.filter((x): x is string => typeof x === "string");
      } else if (typeof legacyValue === "string") {
        values = [legacyValue];
      } else {
        values = [];
      }

      return { name, values: values.filter(Boolean) };
    })
    .filter((a): a is Attribute => a !== null && a.values.length > 0);
}
