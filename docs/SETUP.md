# Setup & vận hành

## Yêu cầu

- Node.js 20+ (đã test với 22)
- npm

## Cài đặt lần đầu

```bash
npm install
```

### Database (Postgres — Supabase)

Dự án đang dùng **Supabase Postgres** (project `duptlckyprmnklpkwayn`, region
ap-northeast-1). `.env` có 2 biến:

- `DATABASE_URL` — **Transaction pooler** (port 6543, `pgbouncer=true`): app dùng lúc
  chạy (nhiều kết nối ngắn hạn, hợp với Next.js/serverless).
- `DIRECT_URL` — **Session pooler** (port 5432, không `pgbouncer`): dùng cho các thao
  tác cần session dài hơn (advisory lock, prepared statement) như chạy migration.

Cả hai đều trỏ tới cùng host pooler (`aws-0-ap-northeast-1.pooler.supabase.com`), khác
port. **Không dùng** "Direct connection" gốc của Supabase
(`db.<ref>.supabase.co:5432`) — host đó chỉ hỗ trợ IPv6 và không kết nối được từ nhiều
mạng.

Muốn tạo lại từ đầu (project Supabase khác)? Vào Supabase Dashboard → Project Settings
→ Database → Connection string, lấy 2 dạng trên, thay vào `.env`.

Sau khi có `.env`:

```bash
npx prisma migrate dev     # áp schema (chỉ cần lại khi schema.prisma thay đổi)
npx prisma db seed         # tạo tài khoản admin + trust profile mặc định
```

**Muốn dev offline, không cần mạng?** Có thể quay lại Postgres cục bộ:
`npx prisma dev -d --name thanhly` in ra một connection string dạng
`postgres://postgres:postgres@localhost:XXXXX/template1?sslmode=disable` — tạm thời
dùng làm `DATABASE_URL` (và `DIRECT_URL` giống hệt, không cần pooler khi chạy local).

#### ⚠️ Nếu `prisma migrate dev`/`migrate deploy`/`migrate status` bị treo (không lỗi, không chạy xong)

Đã gặp trên máy dev: Prisma CLI dùng một engine riêng (viết bằng Rust) để chạy
migration, engine này bị treo khi kết nối Supabase qua mạng có phần mềm chặn/giám sát
kết nối theo từng process (ví dụ antivirus/EDR chặn riêng file thực thi của Prisma
engine, khác `node.exe`) — **đã loại trừ nguyên nhân do Cloudflare WARP** (tắt WARP
test vẫn treo y hệt). Trong khi đó, chính app (qua thư viện `pg`/`@prisma/adapter-pg`)
vẫn kết nối bình thường trên cùng mạng đó — nên chỉ riêng CLI migrate bị ảnh hưởng.

Cách né tạm: dùng `prisma/apply-migration.mjs` (đã có sẵn trong repo) — chạy migration
bằng chính thư viện `pg` thay vì Prisma CLI, rồi tự ghi 1 dòng vào bảng
`_prisma_migrations` để Prisma coi như đã áp dụng (giữ lịch sử migration nhất quán,
phòng khi sau này chạy `prisma migrate` từ máy/CI không bị chặn):

```bash
node prisma/apply-migration.mjs <tên-thư-mục-migration>   # vd. 20260821130000_add_product_attributes
```

Mỗi khi thêm migration mới (sửa `schema.prisma` rồi tự viết file
`prisma/migrations/<timestamp>_<tên>/migration.sql`), chạy lệnh trên để áp lên Supabase,
sau đó `npx prisma generate` (lệnh này không cần kết nối DB nên luôn chạy được) để cập
nhật type. Nếu chạy migration từ máy khác/CI không bị chặn kiểu này thì
`prisma migrate dev`/`deploy` nên hoạt động bình thường, không cần script né.

### Ảnh sản phẩm (Supabase Storage)

Người bán upload ảnh trực tiếp từ máy ở trang đăng/sửa sản phẩm — lưu vào Supabase
Storage (cùng project với DB), không cần dịch vụ ảnh riêng.

`.env` cần thêm:

- `SUPABASE_URL` — dạng `https://<project-ref>.supabase.co` (đã điền sẵn theo project
  Postgres đang dùng).
- `SUPABASE_SERVICE_ROLE_KEY` — lấy ở Supabase Dashboard → Project Settings → API →
  mục "Project API keys" → **service_role** (secret, khác `anon` key). Chỉ dùng ở
  server (Server Actions đã qua `requireAdmin()`), không bao giờ lộ ra trình duyệt.

Bucket `product-images` (public) tự động được tạo ở lần upload đầu tiên — không cần
tạo tay. Giới hạn: JPEG/PNG/WEBP/GIF, tối đa 5MB/ảnh, tối đa 8 ảnh/sản phẩm (chỉnh ở
`src/lib/product-limits.ts`).

### Tìm nhóm Facebook theo từ khóa (Apify)

Trang `/admin/nhom-facebook` (chỉ superadmin) gọi actor Apify
[`scraper-engine/facebook-groups-search-scraper`](https://apify.com/scraper-engine/facebook-groups-search-scraper)
để tìm nhóm Facebook theo từ khóa, phục vụ việc mang sản phẩm sang chia sẻ (không tự
scrape Facebook — dùng dịch vụ bên thứ ba đã có sẵn, người dùng tự chịu trách nhiệm về
tài khoản Apify/chi phí credit).

`.env` cần thêm:

- `APIFY_API_TOKEN` — lấy ở Apify Console → Settings → API & Integrations. Chưa điền
  thì trang báo lỗi thiếu cấu hình, không chặn các tính năng khác của app.

Actor tính số kết quả tối đa (`maxItems`) theo **từng từ khóa** — nhập nhiều từ khóa
cùng lúc sẽ nhân số lượng gọi/credit tương ứng. Giới hạn cứng ở
`src/lib/facebook-groups.ts` (`MAX_ITEMS_LIMIT = 100`/từ khóa) để tránh tốn credit
ngoài ý muốn.

### Tài khoản admin

Seed đọc `ADMIN_EMAIL` / `ADMIN_PASSWORD` từ `.env` (đã có giá trị mặc định để dev —
**đổi trước khi deploy thật**). Chạy lại `npx prisma db seed` sau khi đổi để cập nhật
mật khẩu (script dùng `upsert`, chạy lại an toàn).

### Chạy dev server

```bash
npm run dev
```

- Trang công khai: http://localhost:3000
- Đăng nhập người bán: http://localhost:3000/admin/login

## Build production

```bash
npm run build
npm run start
```

Biến môi trường cần có khi deploy: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (chuỗi
ngẫu nhiên dài, dùng `openssl rand -base64 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (dùng
lúc seed, không cần giữ lại sau đó), `APIFY_API_TOKEN` (tùy chọn — chỉ cần nếu dùng
tính năng tìm nhóm Facebook).

Lưu ý về `sslmode`: dùng `sslmode=no-verify` cho `DATABASE_URL` — **ở mọi nơi, kể cả
production trên Vercel**, không phải chỉ máy dev. Ban đầu tưởng lỗi TLS chỉ do mạng máy
dev (Cloudflare WARP), nhưng deploy thử lên Vercel với `sslmode=require` vẫn gặp y hệt
lỗi `self-signed certificate in certificate chain` (Prisma code `P1011`) — tức đây là
vấn đề giữa chuỗi chứng chỉ của Supabase Postgres pooler và thư viện `pg`
(`@prisma/adapter-pg`), không liên quan mạng cụ thể nào. Kết luận: **luôn dùng
`sslmode=no-verify`** cho `DATABASE_URL` khi dùng Supabase Postgres qua driver adapter
`pg` theo cách dự án này đang làm.

## Deploy lên Vercel

Đã deploy: **https://thanhly-dau-gia-hifen.vercel.app** (project Vercel: `tinntt/thanhly-dau-gia-hifen`).

Biến môi trường đã cấu hình trên Vercel (Project Settings → Environment Variables →
Production) — **không cần `DIRECT_URL`** ở đây (chỉ dùng khi chạy migration cục bộ qua
`prisma/apply-migration.mjs`, app lúc chạy không đụng tới):

- `DATABASE_URL` — giống `.env` cục bộ (transaction pooler, `sslmode=no-verify`).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — giống `.env` cục bộ.
- `APIFY_API_TOKEN` — giống `.env` cục bộ, chỉ cần nếu dùng tính năng tìm nhóm Facebook.
- `AUTH_SECRET` — **khác** giá trị dev, đã tạo mới bằng `openssl rand -base64 32` riêng
  cho production.

`.vercelignore` chặn không cho `.env` cục bộ bị upload kèm lúc deploy (tránh lẫn giá
trị dev vào build production).

**Deploy lại sau khi sửa code:**

```bash
npx vercel --prod --yes
```

**Lưu ý:** lúc setup, `vercel link` không tự kết nối được GitHub repo
(`tinntt0304/Thanhly_PROJ`) để tự deploy mỗi lần `git push` — cần vào Vercel Dashboard →
project → Settings → Git → Connect Git Repository để bật, hoặc tiếp tục deploy thủ công
bằng lệnh trên.

## Những quyết định/giả định đã chốt khi implement (PRD không nói rõ)

PRD (mục 7 — Open Questions) để ngỏ vài điểm. Bản v1 này chọn phương án an toàn nhất để
không chặn tiến độ; có thể đổi sau nếu cần:

- **Bước giá tối thiểu**: số VNĐ cố định do người bán tự đặt theo từng sản phẩm (không
  tính theo %). Người bán tự cân nhắc con số phù hợp với giá trị món hàng.
- **Hết giờ chỉ có 1 lượt trả giá bằng giá khởi điểm**: KHÔNG tự động coi là "đã bán".
  Hệ thống luôn chuyển sang trạng thái "Đã kết thúc — chờ liên hệ" và người bán bấm
  "Đánh dấu đã bán" thủ công sau khi chốt xong với người mua (an toàn hơn, đúng tinh
  thần P0.4 — người bán kiểm soát trạng thái cuối).
- **Ảnh sản phẩm**: upload trực tiếp từ máy, lưu ở Supabase Storage (xem mục ở trên) —
  không giới hạn số ảnh theo lý thuyết nhưng chặn ở 8 ảnh/sản phẩm để tránh lạm dụng.
- **Thuộc tính sản phẩm**: cặp tên–giá trị tự do (vd. "Thương hiệu: Philips", "Dung
  tích: 4L") do người bán tự thêm/xoá theo từng sản phẩm ở trang đăng/sửa, hiển thị
  thành bảng thông số ở trang chi tiết. Không giới hạn số lượng, không có danh sách
  thuộc tính chuẩn hoá theo ngành hàng (khác với hệ thống "thuộc tính" có cấu trúc của
  Shopee/TikTok Shop) — vì v1 không có khái niệm danh mục/ngành hàng.
- **P1.3 (tự động chuyển quyền liên hệ sau 24h không phản hồi)**: chưa làm — đúng như
  PRD xếp P1. Ở v1, người bán tự theo dõi và có thể bấm "Huỷ" một sản phẩm nếu người
  thắng bùng kèo, sau đó liên hệ người trả giá cao thứ nhì qua lịch sử trả giá trong
  trang quản lý (SĐT đầy đủ chỉ người bán thấy được).
- **Xác nhận uy tín / SĐT bùng kèo (P1.4)**: chưa làm, đúng như PRD xếp P1.

Câu hỏi số 5 trong PRD (pháp lý về hiển thị công khai lịch sử trả giá kèm SĐT ẩn một
phần) vẫn còn mở — không thuộc phạm vi kỹ thuật, cần người bán/stakeholder xác nhận.
