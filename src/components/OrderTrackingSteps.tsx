import type { OrderTracking } from "@/lib/orders";

// Thanh tracking ngang kiểu Shopee: 4 mốc nối bằng đường kẻ, mốc đã qua tô đặc + dấu ✓, mốc
// chưa tới để rỗng màu xám. Đơn đã huỷ hiện 1 dòng cảnh báo đỏ thay hẳn thanh tracking (huỷ thì
// không còn "tiến trình" nào để theo dõi nữa).
export function OrderTrackingSteps({ tracking }: { tracking: OrderTracking }) {
  if (tracking.kind === "cancelled") {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-red-600">
        <span aria-hidden="true">✕</span> Đơn hàng đã bị huỷ
      </div>
    );
  }

  const { steps, warning, warningSeverity } = tracking;
  const lastDoneIndex = steps.reduce((acc, s, i) => (s.done ? i : acc), -1);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={step.label} className="flex flex-1 flex-col items-center last:flex-none last:items-end">
            <div className="flex w-full items-center">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  step.done ? "bg-accent-500 text-white" : "border-2 border-neutral-300 bg-surface text-neutral-400"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < lastDoneIndex ? "bg-accent-500" : "bg-neutral-200"}`} />
              )}
            </div>
            <span
              className={`mt-1 max-w-[5.5rem] text-center text-[11px] leading-tight ${
                step.done ? "font-medium text-text" : "text-neutral-400"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      {warning &&
        (warningSeverity === "error" ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700">
            <span aria-hidden="true">⚠</span> {warning}
          </div>
        ) : (
          <p className="text-xs font-medium text-amber-600">
            <span aria-hidden="true">⚠</span> {warning}
          </p>
        ))}
    </div>
  );
}
