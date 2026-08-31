import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { MAX_IMAGE_BYTES } from "@/lib/product-limits";

export const PRODUCT_IMAGES_BUCKET = "product-images";
export const SITE_BANNER_BUCKET = "site-banners";
export const IMAGE_LIBRARY_BUCKET = "image-library";
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Nén ảnh trước khi lưu Supabase Storage — người dùng thường upload thẳng ảnh gốc từ điện
// thoại/máy ảnh (vài MB, kích thước lớn hơn nhiều so với chỗ hiển thị thực tế trên web),
// tốn dung lượng lưu trữ vô ích. Giới hạn cạnh dài nhất + quy hết về WEBP (nén tốt hơn hẳn
// JPEG/PNG cùng chất lượng nhìn, mọi trình duyệt hiện đại đều đọc được).
const MAX_IMAGE_DIMENSION = 1920;
const WEBP_QUALITY = 80;

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

// Tạo bucket nếu chưa có — CHỈ gọi khi upload thật sự báo lỗi "bucket không tồn tại" (xem
// uploadImage), không gọi trước mỗi lần upload như trước đây. listBuckets() trước đây chạy
// lại mỗi lần function serverless khởi động lại (cache ensuredBuckets là in-memory, mất theo
// mỗi cold start trên Vercel) — cộng thêm 1 lượt round-trip mạng vào MỌI request kể cả khi
// bucket đã tồn tại từ lâu, dù trong 99% trường hợp bucket luôn đã có sẵn. Tạo theo kiểu
// try-upload-trước, tạo-khi-thiếu giúp bỏ hẳn round-trip thừa đó ở đường thường gặp nhất.
async function createBucketIfMissing(supabase: ReturnType<typeof createClient>, bucket: string) {
  const { error } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
  });
  // Bỏ qua lỗi "đã tồn tại" — 2 request cùng gặp bucket thiếu gần như đồng thời có thể cùng
  // chạy tới đây, chỉ 1 cái tạo thành công, cái còn lại nhận lỗi trùng nhưng mục tiêu (bucket
  // đã tồn tại) vẫn đạt được, không phải lỗi thật.
  if (error && !error.message?.toLowerCase().includes("already exists")) {
    throw new Error(`Không tạo được bucket ảnh: ${error.message}`);
  }
  ensuredBuckets.add(bucket);
}

// GIF giữ nguyên không nén — sharp mặc định chỉ đọc/ghi được frame đầu tiên của GIF động,
// nén sẽ làm mất hoạt ảnh; định dạng này hiếm gặp trong ảnh sản phẩm/banner nên không đáng
// đánh đổi. JPEG/PNG/WEBP quy hết về WEBP sau khi giới hạn kích thước.
async function compressImage(
  buffer: Buffer,
  contentType: string
): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  if (contentType === "image/gif") {
    return { buffer, contentType, ext: "gif" };
  }

  const outputBuffer = await sharp(buffer)
    .rotate() // đọc EXIF orientation rồi tự xoay đúng chiều trước khi bỏ metadata, tránh ảnh bị lật
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { buffer: outputBuffer, contentType: "image/webp", ext: "webp" };
}

async function uploadImage(file: File, bucket: string, pathPrefix = ""): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Ảnh "${file.name}" vượt quá 5MB.`);
  }
  if (file.type && !ALLOWED_CONTENT_TYPES.has(file.type)) {
    throw new Error(`Ảnh "${file.name}" sai định dạng (chỉ nhận JPEG/PNG/WEBP/GIF).`);
  }

  const supabase = getSupabaseAdmin();

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let uploadBuffer: Buffer<ArrayBufferLike> = rawBuffer;
  let contentType = file.type || "image/jpeg";
  let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  try {
    const compressed = await compressImage(rawBuffer, contentType);
    uploadBuffer = compressed.buffer;
    contentType = compressed.contentType;
    ext = compressed.ext;
  } catch {
    // Nén lỗi (file ảnh hỏng, hoặc định dạng lạ dù đúng content-type khai báo) — vẫn upload
    // bản gốc thay vì chặn hẳn thao tác, không để bước tối ưu phụ chặn luồng chính.
  }

  const path = `${pathPrefix}${crypto.randomUUID()}.${ext}`;
  let { error } = await supabase.storage.from(bucket).upload(path, uploadBuffer, {
    contentType,
    upsert: false,
  });
  // Chỉ tạo bucket + thử lại đúng 1 lần khi thật sự thiếu — đường thường gặp (bucket đã có)
  // không tốn thêm round-trip nào so với upload thẳng.
  if (error?.message === "Bucket not found" && !ensuredBuckets.has(bucket)) {
    await createBucketIfMissing(supabase, bucket);
    ({ error } = await supabase.storage.from(bucket).upload(path, uploadBuffer, {
      contentType,
      upsert: false,
    }));
  }
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

// Thư viện ảnh (/admin/thu-vien-anh) — tải trước ảnh lên lấy link để dán vào cột "Ảnh" khi
// import Excel hàng loạt, không cần đăng từng sản phẩm mới upload được. Bucket riêng với ảnh
// sản phẩm thật (product-images) vì đây chỉ là nơi chuẩn bị link, chưa gắn với Product nào —
// tách theo thư mục con {userId}/ để mỗi tài khoản (kể cả superadmin) chỉ thấy ảnh của chính
// mình — trước đây superadmin gộp xem ảnh của mọi seller, đổi lại vì càng nhiều seller dùng
// càng phải tải nhiều ảnh cùng lúc, ảnh hưởng performance không cần thiết cho 1 trang chỉ để
// chuẩn bị link.
export async function uploadLibraryImage(file: File, userId: string): Promise<string> {
  return uploadImage(file, IMAGE_LIBRARY_BUCKET, `${userId}/`);
}

export type LibraryImage = { url: string; name: string; createdAt: string };

export async function listLibraryImages(userId: string, limit = 200): Promise<LibraryImage[]> {
  const supabase = getSupabaseAdmin();
  // Không cần ensureBucket ở đây — .list() trên bucket chưa tồn tại trả về mảng rỗng (không
  // lỗi), y hệt thư mục rỗng, nên khỏi tốn round-trip kiểm tra trước.
  const { data, error } = await supabase.storage.from(IMAGE_LIBRARY_BUCKET).list(userId, {
    limit,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw new Error(`Không đọc được thư viện ảnh: ${error.message}`);

  return (data ?? [])
    .filter((f) => f.id) // bỏ file giả Supabase trả về đại diện cho thư mục rỗng (id null)
    .map((f) => ({
      name: f.name,
      createdAt: f.created_at ?? new Date().toISOString(),
      url: supabase.storage.from(IMAGE_LIBRARY_BUCKET).getPublicUrl(`${userId}/${f.name}`).data.publicUrl,
    }));
}

// Lấy path "{userId}/{filename}" từ URL public — dùng để (a) xoá đúng file trong bucket và
// (b) đối chiếu userId sở hữu trước khi cho xoá (xem removeLibraryImage ở
// actions/image-library.ts). Trả về null nếu URL lạ, không thuộc bucket này.
export function parseLibraryImagePath(url: string): { path: string; userId: string } | null {
  const marker = `/storage/v1/object/public/${IMAGE_LIBRARY_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length);
  const userId = path.split("/")[0];
  if (!userId) return null;
  return { path, userId };
}

// Nhận mảng path — Supabase remove() xoá nhiều file trong 1 lần gọi mạng duy nhất, dùng cho
// cả xoá 1 ảnh (mảng 1 phần tử) lẫn xoá nhiều ảnh đã chọn, thay vì lặp N lượt gọi riêng lẻ.
export async function deleteLibraryImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(IMAGE_LIBRARY_BUCKET).remove(paths);
  if (error) throw new Error(`Xoá ảnh thất bại: ${error.message}`);
}
