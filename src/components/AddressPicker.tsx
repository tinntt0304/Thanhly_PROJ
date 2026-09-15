"use client";

import { useEffect, useState } from "react";
import { getGhnProvinces, getGhnDistricts, getGhnWards } from "@/lib/actions/orders";
import type { GhnProvince, GhnDistrict, GhnWard } from "@/lib/ghn";
import {
  normalizeAddressText,
  findBestAddressMatch,
  ADDRESS_LEVEL_PREFIXES,
  ADDRESS_SHORT_PREFIXES,
  PROVINCE_ALIASES_LIST,
} from "@/lib/address-detect";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";
const lockedInputClass =
  "rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-500 cursor-not-allowed";

type LookupResult<T> = { ok: true; data: T } | { ok: false; error: string };

// 3 select phụ thuộc (Tỉnh/Thành -> Quận/Huyện -> Phường/Xã) lấy trực tiếp từ GHN — bắt
// buộc vì GHN chỉ nhận địa chỉ người nhận dạng mã (district_id, ward_code), không nhận
// text tự do. Giá trị submit thật nằm ở input ẩn (id + tên hiển thị, để lưu tên đẹp vào
// Order mà không cần tra cứu lại), 3 select chỉ để chọn.
//
// fetchProvinces/Districts/Wards mặc định dùng bản admin (getGhnProvinces...) — form
// "Mua ngay" công khai (BuyNowForm.tsx) truyền vào bản public (getPublicGhnProvinces...,
// không cần đăng nhập) vì khách mua hàng chưa có session admin.
export function AddressPicker({
  initialProvinceId,
  initialProvinceName,
  initialDistrictId,
  initialDistrictName,
  initialWardCode,
  initialWardName,
  locked = false,
  addressHint,
  fetchProvinces = getGhnProvinces,
  fetchDistricts = getGhnDistricts,
  fetchWards = getGhnWards,
}: {
  initialProvinceId?: number;
  initialProvinceName?: string;
  initialDistrictId?: number;
  initialDistrictName?: string;
  initialWardCode?: string;
  initialWardName?: string;
  locked?: boolean;
  // Địa chỉ tự do (ô "Địa chỉ (số nhà, tên đường...)" ở form cha) — mỗi khi đổi (thường
  // truyền vào lúc onBlur, không phải mỗi phím gõ, để đỡ tốn lượt gọi GHN), tự đoán tỉnh/quận/
  // phường khớp nhất và tự chọn sẵn, xem lib/address-detect.ts. CHỈ tự điền phần người dùng
  // CHƯA tự tay chọn — không bao giờ ghi đè lựa chọn thủ công.
  //
  // Quận/huyện chỉ đoán được SAU khi đã có tỉnh (GHN bắt buộc province_id để liệt kê quận/
  // huyện) — địa chỉ không nêu tỉnh (vd "35 Đồng Đen, Phường 12, Tân Bình") thì quận/phường
  // tự điền ngay khi người dùng tự chọn tỉnh (1 lần bấm), không cần gõ lại địa chỉ.
  addressHint?: string;
  fetchProvinces?: () => Promise<LookupResult<GhnProvince[]>>;
  fetchDistricts?: (provinceId: number) => Promise<LookupResult<GhnDistrict[]>>;
  fetchWards?: (districtId: number) => Promise<LookupResult<GhnWard[]>>;
}) {
  const [provinces, setProvinces] = useState<GhnProvince[]>([]);
  const [districts, setDistricts] = useState<GhnDistrict[]>([]);
  const [wards, setWards] = useState<GhnWard[]>([]);

  const [provinceId, setProvinceId] = useState(initialProvinceId ? String(initialProvinceId) : "");
  const [provinceName, setProvinceName] = useState(initialProvinceName ?? "");
  const [districtId, setDistrictId] = useState(initialDistrictId ? String(initialDistrictId) : "");
  const [districtName, setDistrictName] = useState(initialDistrictName ?? "");
  const [wardCode, setWardCode] = useState(initialWardCode ?? "");
  const [wardName, setWardName] = useState(initialWardName ?? "");

  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theo dõi cấp nào đang là do TỰ ĐỘNG điền (không phải người dùng tự tay chọn) — chỉ tự
  // động ghi đè/lấp đầy đúng những cấp này, không đụng vào lựa chọn thủ công. Dùng state (không
  // phải ref) vì logic tự nhận diện bên dưới đọc/ghi giá trị này NGAY TRONG RENDER — lint dự án
  // cấm đọc/ghi ref lúc render (react-hooks/refs).
  const [provinceAutoFilled, setProvinceAutoFilled] = useState(false);
  const [districtAutoFilled, setDistrictAutoFilled] = useState(false);
  const [wardAutoFilled, setWardAutoFilled] = useState(false);

  useEffect(() => {
    fetchProvinces()
      // GHN sandbox có sẵn vài tỉnh "Test - Alert" cố tình trả data: null để test client xử
      // lý lỗi — res.ok vẫn true nhưng res.data không phải mảng, ?? [] để không crash .map().
      .then((res) => (res.ok ? setProvinces(res.data ?? []) : setError(res.error)))
      .finally(() => setLoadingProvinces(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Rỗng thì dọn danh sách con" và "bật loading" đều nằm ở onChange (tương tác thật của
  // người dùng chọn tỉnh/quận), không phải ở đây — effect chỉ còn nhánh fetch, setState
  // của nó luôn nằm trong callback bất đồng bộ .then()/.finally(), tránh lỗi lint
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!provinceId) return;
    fetchDistricts(Number(provinceId))
      .then((res) => (res.ok ? setDistricts(res.data ?? []) : setError(res.error)))
      .finally(() => setLoadingDistricts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceId]);

  useEffect(() => {
    if (!districtId) return;
    fetchWards(Number(districtId))
      .then((res) => (res.ok ? setWards(res.data ?? []) : setError(res.error)))
      .finally(() => setLoadingWards(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtId]);

  // === Tự nhận diện tỉnh/quận/phường từ addressHint ===
  // Tính lại NGAY TRONG RENDER (không dùng useEffect) theo pattern "adjust state while
  // rendering" của React — 3 khối độc lập, mỗi khối tự đoán 1 cấp ngay khi: có addressHint,
  // đã tải xong danh sách của đúng cấp đó, cấp đó chưa được người dùng tự tay chọn, và chưa
  // thử với đúng tổ hợp (hint, cấp cha đang có) này trước đó — tránh thử lại vô hạn lần.
  const normalizedHint = addressHint ? normalizeAddressText(addressHint) : "";

  const [provinceAttemptKey, setProvinceAttemptKey] = useState("");
  if (
    !locked &&
    normalizedHint &&
    normalizedHint !== provinceAttemptKey &&
    provinces.length > 0 &&
    (!provinceId || provinceAutoFilled)
  ) {
    setProvinceAttemptKey(normalizedHint);
    const match = findBestAddressMatch(
      normalizedHint,
      provinces,
      (p) => p.ProvinceName,
      ADDRESS_LEVEL_PREFIXES.province,
      ADDRESS_SHORT_PREFIXES.province,
      PROVINCE_ALIASES_LIST
    );
    if (match) {
      setProvinceAutoFilled(true);
      setDistrictAutoFilled(false);
      setWardAutoFilled(false);
      setProvinceId(String(match.ProvinceID));
      setProvinceName(match.ProvinceName);
      setDistrictId("");
      setDistrictName("");
      setDistricts([]);
      setWardCode("");
      setWardName("");
      setWards([]);
      setLoadingDistricts(true);
    }
  }

  const districtAttemptKey = `${normalizedHint}::${provinceId}`;
  const [lastDistrictAttemptKey, setLastDistrictAttemptKey] = useState("");
  if (
    !locked &&
    normalizedHint &&
    districtAttemptKey !== lastDistrictAttemptKey &&
    districts.length > 0 &&
    (!districtId || districtAutoFilled)
  ) {
    setLastDistrictAttemptKey(districtAttemptKey);
    const match = findBestAddressMatch(
      normalizedHint,
      districts,
      (d) => d.DistrictName,
      ADDRESS_LEVEL_PREFIXES.district,
      ADDRESS_SHORT_PREFIXES.district
    );
    if (match) {
      setDistrictAutoFilled(true);
      setWardAutoFilled(false);
      setDistrictId(String(match.DistrictID));
      setDistrictName(match.DistrictName);
      setWardCode("");
      setWardName("");
      setWards([]);
      setLoadingWards(true);
    }
  }

  const wardAttemptKey = `${normalizedHint}::${districtId}`;
  const [lastWardAttemptKey, setLastWardAttemptKey] = useState("");
  if (
    !locked &&
    normalizedHint &&
    wardAttemptKey !== lastWardAttemptKey &&
    wards.length > 0 &&
    (!wardCode || wardAutoFilled)
  ) {
    setLastWardAttemptKey(wardAttemptKey);
    const match = findBestAddressMatch(
      normalizedHint,
      wards,
      (w) => w.WardName,
      ADDRESS_LEVEL_PREFIXES.ward,
      ADDRESS_SHORT_PREFIXES.ward
    );
    if (match) {
      setWardAutoFilled(true);
      setWardCode(match.WardCode);
      setWardName(match.WardName);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text">Tỉnh/Thành</label>
          <select
            value={provinceId}
            onChange={(e) => {
              const id = e.target.value;
              const p = provinces.find((x) => String(x.ProvinceID) === id);
              setProvinceAutoFilled(false);
              setDistrictAutoFilled(false);
              setWardAutoFilled(false);
              setProvinceId(id);
              setProvinceName(p?.ProvinceName ?? "");
              setDistrictId("");
              setDistrictName("");
              setDistricts([]);
              setWardCode("");
              setWardName("");
              setWards([]);
              setLoadingDistricts(!!id);
            }}
            required
            disabled={locked}
            className={locked ? lockedInputClass : inputClass}
          >
            <option value="">{loadingProvinces ? "Đang tải..." : "-- Chọn --"}</option>
            {provinces.map((p) => (
              <option key={p.ProvinceID} value={p.ProvinceID}>
                {p.ProvinceName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text">Quận/Huyện</label>
          <select
            value={districtId}
            onChange={(e) => {
              const id = e.target.value;
              const d = districts.find((x) => String(x.DistrictID) === id);
              setDistrictAutoFilled(false);
              setWardAutoFilled(false);
              setDistrictId(id);
              setDistrictName(d?.DistrictName ?? "");
              setWardCode("");
              setWardName("");
              setWards([]);
              setLoadingWards(!!id);
            }}
            required
            disabled={locked || !provinceId}
            className={locked ? lockedInputClass : inputClass}
          >
            <option value="">{loadingDistricts ? "Đang tải..." : "-- Chọn --"}</option>
            {districts.map((d) => (
              <option key={d.DistrictID} value={d.DistrictID}>
                {d.DistrictName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text">Phường/Xã</label>
          <select
            value={wardCode}
            onChange={(e) => {
              const code = e.target.value;
              const w = wards.find((x) => x.WardCode === code);
              setWardAutoFilled(false);
              setWardCode(code);
              setWardName(w?.WardName ?? "");
            }}
            required
            disabled={locked || !districtId}
            className={locked ? lockedInputClass : inputClass}
          >
            <option value="">{loadingWards ? "Đang tải..." : "-- Chọn --"}</option>
            {wards.map((w) => (
              <option key={w.WardCode} value={w.WardCode}>
                {w.WardName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <input type="hidden" name="provinceId" value={provinceId} />
      <input type="hidden" name="provinceName" value={provinceName} />
      <input type="hidden" name="districtId" value={districtId} />
      <input type="hidden" name="districtName" value={districtName} />
      <input type="hidden" name="wardCode" value={wardCode} />
      <input type="hidden" name="wardName" value={wardName} />
    </div>
  );
}
