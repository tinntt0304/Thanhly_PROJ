// Đấu nối API "Giao Hàng Nhanh" (GHN) — https://api.ghn.vn/home/docs — để tạo vận đơn
// thật + tra cứu trạng thái giao hàng cho tính năng "Quản lý đơn hàng" ở /admin/orders.
// GHN_ENV="sandbox" (mặc định) dùng dev-online-gateway.ghn.vn, không đụng tài khoản GHN
// thật — đổi sang "production" trong .env khi đã sẵn sàng giao hàng thật.

const SHIPPING_BASE = {
  sandbox: "https://dev-online-gateway.ghn.vn/shiip/public-api/v2",
  production: "https://online-gateway.ghn.vn/shiip/public-api/v2",
};
const MASTER_DATA_BASE = {
  sandbox: "https://dev-online-gateway.ghn.vn/shiip/public-api/master-data",
  production: "https://online-gateway.ghn.vn/shiip/public-api/master-data",
};

function env() {
  return process.env.GHN_ENV === "production" ? "production" : "sandbox";
}

function assertConfigured() {
  if (!process.env.GHN_TOKEN || !process.env.GHN_SHOP_ID) {
    throw new Error("Chưa cấu hình GHN_TOKEN/GHN_SHOP_ID — liên hệ quản trị viên để hoàn tất thiết lập.");
  }
}

// Province/District/Ward chỉ cần Token, không cần ShopId — tách riêng khỏi
// assertConfigured() (dùng cho các action cần cả ShopId: tạo/huỷ vận đơn).
function assertHasToken() {
  if (!process.env.GHN_TOKEN) {
    throw new Error("Chưa cấu hình GHN_TOKEN — liên hệ quản trị viên để hoàn tất thiết lập.");
  }
}

async function ghnFetch<T>(url: string, body: unknown, includeShopId: boolean): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Token: process.env.GHN_TOKEN!,
  };
  if (includeShopId) headers.ShopId = process.env.GHN_SHOP_ID!;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok || json.code !== 200) {
    throw new Error(json.message || json.code_message || "Gọi API GHN thất bại.");
  }
  return json.data as T;
}

export type GhnProvince = { ProvinceID: number; ProvinceName: string };
export type GhnDistrict = { DistrictID: number; ProvinceID: number; DistrictName: string };
export type GhnWard = { WardCode: string; DistrictID: number; WardName: string };

export async function getProvinces(): Promise<GhnProvince[]> {
  assertHasToken();
  return ghnFetch<GhnProvince[]>(`${MASTER_DATA_BASE[env()]}/province`, {}, false);
}

export async function getDistricts(provinceId: number): Promise<GhnDistrict[]> {
  assertHasToken();
  return ghnFetch<GhnDistrict[]>(`${MASTER_DATA_BASE[env()]}/district`, { province_id: provinceId }, false);
}

export async function getWards(districtId: number): Promise<GhnWard[]> {
  assertHasToken();
  return ghnFetch<GhnWard[]>(`${MASTER_DATA_BASE[env()]}/ward`, { district_id: districtId }, false);
}

// Giá trị cho phép của required_note — quyết định người mua có được xem/thử hàng trước
// khi nhận hay không, ảnh hưởng trực tiếp tới tranh chấp giao hàng.
export const REQUIRED_NOTE_OPTIONS = [
  { value: "KHONGCHOXEMHANG", label: "Không cho xem hàng" },
  { value: "CHOXEMHANGKHONGTHU", label: "Cho xem hàng, không cho thử" },
  { value: "CHOTHUHANG", label: "Cho thử hàng" },
] as const;
export type RequiredNote = (typeof REQUIRED_NOTE_OPTIONS)[number]["value"];

// Dịch vụ giao hàng tiêu chuẩn (E-commerce) — cố định, không cho chọn để tránh phải gọi
// thêm API "available services" (cần district gửi+nhận) chỉ để chọn 1 trong số ít lựa
// chọn hầu như luôn giống nhau cho hàng thanh lý/đấu giá thông thường.
const SERVICE_TYPE_ID = 2;

export type CreateGhnOrderInput = {
  toName: string;
  toPhone: string;
  toAddress: string;
  toWardCode: string;
  toDistrictId: number;
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  codAmount: number;
  insuranceValue: number;
  content: string;
  requiredNote: RequiredNote;
  paymentTypeId: 1 | 2; // 1 = shop trả phí ship, 2 = người mua trả
  clientOrderCode: string; // gắn Order.id nội bộ để đối soát 2 chiều
  items: { name: string; quantity: number }[];
};

export type CreateGhnOrderResult = {
  order_code: string;
  total_fee: number;
  expected_delivery_time: string;
};

export async function createGhnOrder(input: CreateGhnOrderInput): Promise<CreateGhnOrderResult> {
  assertConfigured();
  const fromName = process.env.GHN_FROM_NAME;
  const fromPhone = process.env.GHN_FROM_PHONE;
  const fromAddress = process.env.GHN_FROM_ADDRESS;
  const fromWard = process.env.GHN_FROM_WARD_NAME;
  const fromDistrict = process.env.GHN_FROM_DISTRICT_NAME;
  const fromProvince = process.env.GHN_FROM_PROVINCE_NAME;
  if (!fromName || !fromPhone || !fromAddress || !fromWard || !fromDistrict || !fromProvince) {
    throw new Error("Chưa cấu hình địa chỉ lấy hàng GHN_FROM_* — liên hệ quản trị viên để hoàn tất thiết lập.");
  }

  return ghnFetch<CreateGhnOrderResult>(
    `${SHIPPING_BASE[env()]}/shipping-order/create`,
    {
      from_name: fromName,
      from_phone: fromPhone,
      from_address: fromAddress,
      from_ward_name: fromWard,
      from_district_name: fromDistrict,
      from_province_name: fromProvince,
      to_name: input.toName,
      to_phone: input.toPhone,
      to_address: input.toAddress,
      to_ward_code: input.toWardCode,
      to_district_id: input.toDistrictId,
      weight: input.weightGram,
      length: input.lengthCm,
      width: input.widthCm,
      height: input.heightCm,
      service_type_id: SERVICE_TYPE_ID,
      payment_type_id: input.paymentTypeId,
      required_note: input.requiredNote,
      cod_amount: input.codAmount || undefined,
      insurance_value: input.insuranceValue || undefined,
      content: input.content,
      client_order_code: input.clientOrderCode,
      items: input.items,
    },
    true
  );
}

export type GhnOrderDetail = {
  order_code: string;
  status: string;
  log: { status: string; updated_date: string }[];
};

export async function getGhnOrderDetail(orderCode: string): Promise<GhnOrderDetail> {
  assertHasToken();
  return ghnFetch<GhnOrderDetail>(`${SHIPPING_BASE[env()]}/shipping-order/detail`, { order_code: orderCode }, false);
}

export async function cancelGhnOrder(orderCode: string): Promise<void> {
  assertConfigured();
  await ghnFetch<unknown>(`${SHIPPING_BASE[env()]}/switch-status/cancel`, { order_codes: [orderCode] }, true);
}

// Nhãn tiếng Việt cho các trạng thái GHN thường gặp — trạng thái lạ (hiếm/mới thêm) vẫn
// hiển thị được bằng cách rơi về chính giá trị thô, không throw lỗi.
export const GHN_STATUS_LABEL: Record<string, string> = {
  ready_to_pick: "Chờ lấy hàng",
  picking: "Đang lấy hàng",
  money_collect_picking: "Đang thu tiền lấy hàng",
  picked: "Đã lấy hàng",
  storing: "Đang lưu kho",
  transporting: "Đang trung chuyển",
  sorting: "Đang phân loại",
  delivering: "Đang giao hàng",
  money_collect_delivering: "Đang thu tiền giao hàng",
  delivered: "Đã giao thành công",
  delivery_fail: "Giao thất bại",
  waiting_to_return: "Chờ trả hàng",
  return: "Đang trả hàng",
  returned: "Đã trả hàng",
  return_fail: "Trả hàng thất bại",
  exception: "Có ngoại lệ",
  damage: "Hàng bị hư hỏng",
  lost: "Thất lạc",
  cancel: "Đã huỷ",
};

export function ghnStatusLabel(status: string): string {
  return GHN_STATUS_LABEL[status] ?? status;
}
