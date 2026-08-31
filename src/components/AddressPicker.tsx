"use client";

import { useEffect, useState } from "react";
import { getGhnProvinces, getGhnDistricts, getGhnWards } from "@/lib/actions/orders";
import type { GhnProvince, GhnDistrict, GhnWard } from "@/lib/ghn";

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
