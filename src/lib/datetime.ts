// Định dạng dùng chung cho input type="datetime-local" (và làm định dạng chuẩn khi
// đọc ngày giờ từ file Excel import) — "yyyy-MM-ddTHH:mm" theo giờ local, không phải UTC.
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}
