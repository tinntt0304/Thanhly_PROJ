export type Attribute = { name: string; value: string };

export function asAttributes(value: unknown): Attribute[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Attribute =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as Attribute).name === "string" &&
      typeof (v as Attribute).value === "string"
  );
}
