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

Cách né tạm: chạy migration bằng chính `pg` thay vì Prisma CLI. Ví dụ script tối giản
(đọc file `.sql` trong `prisma/migrations/<tên>/migration.sql`, chạy bằng
`new pg.Client({ connectionString: process.env.DIRECT_URL })`, rồi tự insert 1 dòng
vào bảng `_prisma_migrations` để Prisma coi như đã áp dụng — xem lịch sử git để tham
khảo script mẫu đã dùng, đã xoá sau khi chạy xong). Nếu chạy migration từ máy khác/CI
không bị chặn kiểu này thì `prisma migrate deploy` nên chạy bình thường không cần né.

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
lúc seed, không cần giữ lại sau đó).

Lưu ý về `sslmode`: `.env` hiện dùng `sslmode=no-verify` vì mạng máy dev chặn việc xác
thực chuỗi chứng chỉ TLS đầy đủ (xem mục treo `migrate` bên dưới). Khi deploy lên hạ
tầng không bị chặn kiểu này (Vercel, VPS thông thường...), nên đổi lại thành
`sslmode=require` để bật xác thực chứng chỉ đầy đủ, an toàn hơn.

## Những quyết định/giả định đã chốt khi implement (PRD không nói rõ)

PRD (mục 7 — Open Questions) để ngỏ vài điểm. Bản v1 này chọn phương án an toàn nhất để
không chặn tiến độ; có thể đổi sau nếu cần:

- **Bước giá tối thiểu**: số VNĐ cố định do người bán tự đặt theo từng sản phẩm (không
  tính theo %). Người bán tự cân nhắc con số phù hợp với giá trị món hàng.
- **Hết giờ chỉ có 1 lượt trả giá bằng giá khởi điểm**: KHÔNG tự động coi là "đã bán".
  Hệ thống luôn chuyển sang trạng thái "Đã kết thúc — chờ liên hệ" và người bán bấm
  "Đánh dấu đã bán" thủ công sau khi chốt xong với người mua (an toàn hơn, đúng tinh
  thần P0.4 — người bán kiểm soát trạng thái cuối).
- **Ảnh sản phẩm**: người bán dán link ảnh (mỗi dòng 1 link) thay vì upload file trực
  tiếp — vì v1 chưa chọn nhà cung cấp lưu trữ ảnh (S3/Cloudinary/...). Có thể tự upload
  ảnh lên bất kỳ dịch vụ ảnh nào (Imgur, Cloudinary, Google Photos share link...) rồi
  dán link. Nâng cấp lên upload trực tiếp là việc làm sau nếu cần.
- **P1.3 (tự động chuyển quyền liên hệ sau 24h không phản hồi)**: chưa làm — đúng như
  PRD xếp P1. Ở v1, người bán tự theo dõi và có thể bấm "Huỷ" một sản phẩm nếu người
  thắng bùng kèo, sau đó liên hệ người trả giá cao thứ nhì qua lịch sử trả giá trong
  trang quản lý (SĐT đầy đủ chỉ người bán thấy được).
- **Xác nhận uy tín / SĐT bùng kèo (P1.4)**: chưa làm, đúng như PRD xếp P1.

Câu hỏi số 5 trong PRD (pháp lý về hiển thị công khai lịch sử trả giá kèm SĐT ẩn một
phần) vẫn còn mở — không thuộc phạm vi kỹ thuật, cần người bán/stakeholder xác nhận.
