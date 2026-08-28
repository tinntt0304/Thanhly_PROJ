import { createClient } from "@supabase/supabase-js";
import { MAX_IMAGE_BYTES } from "@/lib/product-limits";

export const PRODUCT_IMAGES_BUCKET = "product-images";
export const SITE_BANNER_BUCKET = "site-banners";
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let cachedClient: ReturnType<typeof createClient> | null = null;
const ensuredBuckets = new Set<string>();

// Dùng service role key: chỉ gọi từ Server Actions đã qua requireAdmin(), không bao giờ
// lộ ra client. Bypass RLS nên không cần cấu hình policy riêng cho bucket.
function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env — cần khai báo để upload ảnh."
    );
  }

  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

// Gọi (rẻ, cache trong tiến trình) trước lần upload đầu tiên để tự tạo bucket nếu
// project Supabase chưa có sẵn — người vận hành không cần bước setup thủ công riêng.
// Theo dõi riêng từng bucket (Set) vì giờ có 2 bucket khác nhau (ảnh sản phẩm + banner).
async function ensureBucket(supabase: ReturnType<typeof createClient>, bucket: string) {
  if (ensuredBuckets.has(bucket)) return;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Không đọc được danh sách bucket: ${listError.message}`);

  if (!buckets.some((b) => b.name === bucket)) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
    });
    if (createError) throw new Error(`Không tạo được bucket ảnh: ${createError.message}`);
  }
  ensuredBuckets.add(bucket);
}

async function uploadImage(file: File, bucket: string): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Ảnh "${file.name}" vượt quá 5MB.`);
  }
  if (file.type && !ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new Error(`Ảnh "${file.name}" sai định dạng (chỉ nhận JPEG/PNG/WEBP/GIF).`);
  }

  const supabase = getSupabaseAdmin();
  await ensureBucket(supabase, bucket);
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Upload ảnh "${file.name}" thất bại: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProductImage(file: File): Promise<string> {
  return uploadImage(file, PRODUCT_IMAGES_BUCKET);
}

// Banner trang chủ (/admin/danh-muc) — bucket riêng với ảnh sản phẩm để dễ quản lý/dọn dẹp
// độc lập, dù dùng chung logic validate + upload.
export async function uploadBannerImage(file: File): Promise<string> {
  return uploadImage(file, SITE_BANNER_BUCKET);
}

// Xoá file vật lý khỏi bucket khi bấm xoá 1 ảnh banner trong slideshow — best-effort (xem
// removeBannerImage ở actions/site-content.ts), URL lạ không thuộc bucket này thì bỏ qua an
// toàn thay vì lỗi (vd. dữ liệu banner cũ nhập tay không qua flow upload chuẩn).
export async function deleteBannerImage(url: string): Promise<void> {
  const marker = `/storage/v1/object/public/${SITE_BANNER_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);

  const supabase = getSupabaseAdmin();
  await supabase.storage.from(SITE_BANNER_BUCKET).remove([path]);
}
