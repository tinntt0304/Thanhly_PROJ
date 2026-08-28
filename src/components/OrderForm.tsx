"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { checkPhoneReturnRate, reportBadPhone, type OrderFormState } from "@/lib/actions/orders";
import type { PhoneRiskDisplay } from "@/lib/orders";
import { AddressPicker } from "@/components/AddressPicker";

const initialState: OrderFormState = {};

// Màu badge theo 4 mức cảnh báo (gộp tỉ lệ hoàn GHN + lượt báo xấu nội bộ, xem
// combinePhoneRisk ở lib/orders.ts) — level lạ vẫn hiện được, chỉ rơi về màu trung tính.
const RETURN_RATE_STYLE: Record<string, string> = {
  level_1: "bg-accent-2-100 text-accent-2-700",
  level_2: "bg-yellow-100 text-yellow-800",
  level_3: "bg-orange-100 text-orange-800",
  level_4: "bg-red-100 text-red-700",
};

type PhoneRiskData = PhoneRiskDisplay & { hasReportedByMe: boolean };
type PhoneCheckState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: PhoneRiskData | null }
  | { kind: "error" };

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";
const lockedInputClass =
  "rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-500 cursor-not-allowed";

// Dùng chung cho cả tạo đơn mới (/admin/orders/new) và sửa đơn đã tạo (/admin/orders/[id])
// — mỗi trường đều có label + textbox riêng (GHN cho sửa hầu hết các trường này qua
// shipping-order/update khi đơn còn ở giai đoạn cho phép, xem updateOrder ở actions/orders.ts).
export function OrderForm({
  action,
  submitLabel = "Tạo đơn hàng",
  pendingLabel = "Đang tạo...",
  savedMessage = "Đã lưu thay đổi.",
  defaultBuyerName,
  defaultBuyerPhone,
  defaultBuyerAddress,
  defaultProvinceId,
  defaultProvinceName,
  defaultDistrictId,
  defaultDistrictName,
  defaultWardCode,
  defaultWardName,
  defaultCodAmount,
  defaultWeightGram = 500,
  defaultLengthCm = 20,
  defaultWidthCm = 20,
  defaultHeightCm = 10,
  defaultNote,
  defaultShopPaysShipping = false,
  recipientLocked = false,
  codLocked = false,
}: {
  action: (prevState: OrderFormState | undefined, formData: FormData) => Promise<OrderFormState>;
  submitLabel?: string;
  pendingLabel?: string;
  savedMessage?: string;
  defaultBuyerName?: string;
  defaultBuyerPhone?: string;
  defaultBuyerAddress?: string;
  defaultProvinceId?: number;
  defaultProvinceName?: string;
  defaultDistrictId?: number;
  defaultDistrictName?: string;
  defaultWardCode?: string;
  defaultWardName?: string;
  defaultCodAmount?: number;
  defaultWeightGram?: number;
  defaultLengthCm?: number;
  defaultWidthCm?: number;
  defaultHeightCm?: number;
  defaultNote?: string;
  defaultShopPaysShipping?: boolean;
  // GHN đã lấy hàng thật (recipientLocked) / đã bắt đầu giao-hoàn-huỷ (codLocked) — tô xám
  // các trường GHN không còn cho sửa nữa, xem getOrderFieldLocks (src/lib/orders.ts).
  recipientLocked?: boolean;
  codLocked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  const [phoneCheck, setPhoneCheck] = useState<PhoneCheckState>(
    defaultBuyerPhone?.trim() ? { kind: "loading" } : { kind: "idle" }
  );
  const [lastCheckedPhone, setLastCheckedPhone] = useState<string | null>(defaultBuyerPhone?.trim() || null);
  const [reportPending, setReportPending] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  function checkPhone(rawPhone: string) {
    const phone = rawPhone.trim();
    if (!phone || phone === lastCheckedPhone) return;
    setLastCheckedPhone(phone);
    setPhoneCheck({ kind: "loading" });
    checkPhoneReturnRate(phone).then((res) => {
      setPhoneCheck(res.ok ? { kind: "ok", data: res.data } : { kind: "error" });
    });
  }

  // Kiểm tra ngay khi vào trang nếu đã có sẵn SĐT (trang sửa đơn) — trang tạo mới thì chỉ
  // kiểm khi người dùng rời khỏi ô SĐT (onBlur bên dưới). Không gọi checkPhone() (setState
  // đồng bộ ở đầu hàm) trực tiếp trong effect — chỉ .then() mới được set state trong effect.
  useEffect(() => {
    const phone = defaultBuyerPhone?.trim();
    if (!phone) return;
    checkPhoneReturnRate(phone).then((res) => {
      setPhoneCheck(res.ok ? { kind: "ok", data: res.data } : { kind: "error" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seller tự báo SĐT này là xấu — cộng đồng seller có thể đẩy mức cảnh báo lên nhanh hơn
  // là chờ GHN tự cập nhật lại tỉ lệ hoàn của họ (xem reportBadPhone ở actions/orders.ts).
  async function handleReportBadPhone() {
    const phone = phoneInputRef.current?.value.trim();
    if (!phone) return;
    const reason = window.prompt("Lý do báo xấu SĐT này (không bắt buộc):");
    if (reason === null) return; // bấm Huỷ trên hộp thoại
    setReportPending(true);
    const res = await reportBadPhone(phone, reason || undefined);
    setReportPending(false);
    if (res.ok) {
      setLastCheckedPhone(phone);
      setPhoneCheck({ kind: "ok", data: res.data });
    } else {
      window.alert(res.error);
    }
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {recipientLocked && (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
          Vận đơn GHN đã lấy hàng — không sửa được thông tin người nhận, địa chỉ và kích
          thước/cân nặng nữa.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="buyerName" className="text-sm font-medium text-text">
            Tên người nhận
          </label>
          <input
            id="buyerName"
            name="buyerName"
            defaultValue={defaultBuyerName}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="buyerPhone" className="text-sm font-medium text-text">
            SĐT người nhận
          </label>
          <input
            ref={phoneInputRef}
            id="buyerPhone"
            name="buyerPhone"
            defaultValue={defaultBuyerPhone}
            required
            readOnly={recipientLocked}
            onBlur={(e) => checkPhone(e.target.value)}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            {phoneCheck.kind === "loading" && (
              <span className="text-xs text-neutral-500">Đang kiểm tra mức độ an toàn...</span>
            )}
            {phoneCheck.kind === "ok" && phoneCheck.data && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  RETURN_RATE_STYLE[phoneCheck.data.levelCode] ?? "bg-neutral-100 text-neutral-700"
                }`}
              >
                {phoneCheck.data.level}
                {phoneCheck.data.rate !== null && ` (tỷ lệ hoàn ${phoneCheck.data.rate}%)`}
                {phoneCheck.data.reportCount > 0 &&
                  ` · ${phoneCheck.data.reportCount} lượt báo xấu`}
              </span>
            )}
            <button
              type="button"
              onClick={handleReportBadPhone}
              disabled={reportPending || (phoneCheck.kind === "ok" && phoneCheck.data?.hasReportedByMe)}
              className="text-xs font-medium text-red-600 underline decoration-dotted hover:text-red-700 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
            >
              {phoneCheck.kind === "ok" && phoneCheck.data?.hasReportedByMe
                ? "Đã báo xấu SĐT này"
                : reportPending
                  ? "Đang gửi báo xấu..."
                  : "Báo xấu SĐT"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="buyerAddress" className="text-sm font-medium text-text">
          Địa chỉ (số nhà, tên đường...)
        </label>
        <input
          id="buyerAddress"
          name="buyerAddress"
          defaultValue={defaultBuyerAddress}
          required
          readOnly={recipientLocked}
          className={recipientLocked ? lockedInputClass : inputClass}
        />
      </div>

      <AddressPicker
        initialProvinceId={defaultProvinceId}
        initialProvinceName={defaultProvinceName}
        initialDistrictId={defaultDistrictId}
        initialDistrictName={defaultDistrictName}
        initialWardCode={defaultWardCode}
        initialWardName={defaultWardName}
        locked={recipientLocked}
      />

      {codLocked && (
        <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
          Đơn đã bắt đầu giao/hoàn/huỷ — không sửa được tiền thu hộ, bên trả phí ship và
          ghi chú nữa.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="codAmount" className="text-sm font-medium text-text">
            Tiền thu hộ (COD, VNĐ)
          </label>
          <input
            id="codAmount"
            name="codAmount"
            type="number"
            min={0}
            defaultValue={defaultCodAmount ?? 0}
            required
            readOnly={codLocked}
            className={codLocked ? lockedInputClass : inputClass}
          />
        </div>
        <label
          className={`flex items-center gap-2 pb-2 text-sm sm:pt-6 ${codLocked ? "text-neutral-400" : "text-neutral-700"}`}
        >
          <input
            type="checkbox"
            name={codLocked ? undefined : "shopPaysShipping"}
            defaultChecked={defaultShopPaysShipping}
            disabled={codLocked}
            className="h-4 w-4 rounded border-neutral-300 disabled:cursor-not-allowed"
          />
          Shop tự trả phí ship (mặc định người mua trả khi nhận hàng)
          {codLocked && defaultShopPaysShipping && (
            <input type="hidden" name="shopPaysShipping" value="on" />
          )}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="weightGram" className="text-sm font-medium text-text">
            Cân nặng (g)
          </label>
          <input
            id="weightGram"
            name="weightGram"
            type="number"
            min={1}
            defaultValue={defaultWeightGram}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lengthCm" className="text-sm font-medium text-text">
            Dài (cm)
          </label>
          <input
            id="lengthCm"
            name="lengthCm"
            type="number"
            min={1}
            defaultValue={defaultLengthCm}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="widthCm" className="text-sm font-medium text-text">
            Rộng (cm)
          </label>
          <input
            id="widthCm"
            name="widthCm"
            type="number"
            min={1}
            defaultValue={defaultWidthCm}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="heightCm" className="text-sm font-medium text-text">
            Cao (cm)
          </label>
          <input
            id="heightCm"
            name="heightCm"
            type="number"
            min={1}
            defaultValue={defaultHeightCm}
            required
            readOnly={recipientLocked}
            className={recipientLocked ? lockedInputClass : inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm font-medium text-text">
          Ghi chú (không bắt buộc)
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          defaultValue={defaultNote}
          readOnly={codLocked}
          className={codLocked ? lockedInputClass : inputClass}
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-accent-2-700">{savedMessage}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
