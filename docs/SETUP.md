# Setup & vận hành

## Yêu cầu

- Node.js 20+ (đã test với 22)
- npm

## Cài đặt lần đầu

```bash
npm install
```

### Database (Postgres)

Dev dùng Postgres cục bộ do chính Prisma chạy (không cần cài Postgres/Docker riêng):

```bash
npx prisma dev -d --name thanhly   # khởi động server Postgres cục bộ, chạy nền
```

Lệnh trên in ra một connection string dạng
`postgres://postgres:postgres@localhost:XXXXX/template1?sslmode=disable` — copy giá
trị đó vào biến `DATABASE_URL` trong file `.env` (file `.env` đã có sẵn, chỉ cần sửa
port nếu khác). Server này chạy nền trong Docker Desktop / tiến trình cục bộ; nếu tắt
máy hoặc `npx prisma dev stop`, chạy lại lệnh trên trước khi `npm run dev`.

Với môi trường production, thay `DATABASE_URL` bằng connection string Postgres thật
(Neon, Supabase, Railway, RDS...).

Sau khi có `DATABASE_URL`:

```bash
npx prisma migrate dev     # áp schema (chỉ cần lại khi schema.prisma thay đổi)
npx prisma db seed         # tạo tài khoản admin + trust profile mặc định
```

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

Biến môi trường cần có khi deploy: `DATABASE_URL`, `AUTH_SECRET` (chuỗi ngẫu nhiên dài,
dùng `openssl rand -base64 32`), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (dùng lúc seed, không
cần giữ lại sau đó).

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
