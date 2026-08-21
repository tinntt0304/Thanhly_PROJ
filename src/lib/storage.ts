import { createClient } from "@supabase/supabase-js";
import { MAX_IMAGE_BYTES } from "@/lib/product-limits";

export const PRODUCT_IMAGES_BUCKET = "product-images";
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let cachedClient: ReturnType<typeof createClient> | null = null;
let bucketEnsured = false;

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
async function ensureProductImagesBucket(supabase: ReturnType<typeof createClient>) {
  if (bucketEnsured) return;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Không đọc được danh sách bucket: ${listError.message}`);

  if (!buckets.some((b) => b.name === PRODUCT_IMAGES_BUCKET)) {
    const { error: createError } = await supabase.storage.createBucket(PRODUCT_IMAGES_BUCKET, {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
    });
    if (createError) throw new Error(`Không tạo được bucket ảnh: ${createError.message}`);
  }
  bucketEnsured = true;
}

export async function uploadProductImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Ảnh "${file.name}" vượt quá 5MB.`);
  }
  if (file.type && !ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new Error(`Ảnh "${file.name}" sai định dạng (chỉ nhận JPEG/PNG/WEBP/GIF).`);
  }

  const supabase = getSupabaseAdmin();
  await ensureProductImagesBucket(supabase);
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Upload ảnh "${file.name}" thất bại: ${error.message}`);

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
