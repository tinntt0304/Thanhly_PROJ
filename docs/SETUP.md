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

### Tìm nhóm Facebook theo từ khóa (Apify) + hệ thống credit trả phí

Trang `/admin/nhom-facebook` (mọi tài khoản đã đăng nhập — SUPERADMIN lẫn SELLER) gọi
actor Apify
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

**SELLER phải trả phí credit** cho mỗi lượt tìm thực sự gọi Apify (lượt phục vụ từ cache
thì miễn phí) — SUPERADMIN không bị tính phí. Giá bán/kết quả chỉnh ở
`/admin/danh-muc` (mặc định `DEFAULT_PRICE_PER_RESULT` trong `src/lib/credits.ts`).

Nạp credit qua chuyển khoản ngân hàng tự động đối soát bằng **SePay** (`/admin/nap-credit`):

- `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_HOLDER` — tài khoản ngân hàng
  nhận tiền, dùng tạo mã QR VietQR động (`vietqr.app/img?...`). `SEPAY_BANK_CODE` lấy
  theo danh sách ngân hàng VietQR hỗ trợ (vd. `vietcombank`, `acb`, `mbbank`).
- `SEPAY_WEBHOOK_API_KEY` — đặt ở SePay Dashboard → WebHooks → thêm mới → Authentication
  Type = "API Key", trỏ webhook URL về `https://<domain>/api/webhooks/sepay`. SePay gửi
  lại đúng key này trong header `Authorization` mỗi khi có giao dịch — dùng xác thực
  webhook thật sự đến từ SePay.

Chưa điền các biến `SEPAY_*` thì trang nạp credit vẫn tạo được mã tham chiếu nhưng báo
"chưa cấu hình tài khoản nhận tiền", không tạo được QR — không chặn tính năng khác.

Webhook `/api/webhooks/sepay` khớp giao dịch với yêu cầu nạp đang chờ (`TopUpRequest`)
bằng cách tìm `referenceCode` (nhúng trong nội dung chuyển khoản/QR) xuất hiện trong
`content` SePay gửi về — idempotent (gọi lại nhiều lần không cộng tiền 2 lần nhờ kiểm
tra `status` trong 1 transaction DB).

### Quản lý đơn hàng + vận chuyển GHN (Giao Hàng Nhanh)

Trang `/admin/orders` (mọi tài khoản đã đăng nhập, mỗi người chỉ thấy đơn của mình —
SUPERADMIN thấy tất cả, giống quy ước Sản phẩm). Đơn hàng tạo từ nút "Tạo đơn hàng" ở
trang sửa 1 sản phẩm đã "Đánh dấu đã bán". Tích hợp API GHN thật để tạo vận đơn + tra cứu
trạng thái giao hàng (không tự viết logic vận chuyển).

`.env` cần thêm:

- `GHN_ENV` — `"sandbox"` (mặc định, dùng `dev-online-gateway.ghn.vn`, không đụng tài
  khoản GHN thật) hoặc `"production"` (`online-gateway.ghn.vn`, đơn tạo ra được lấy hàng
  thật).
- `GHN_TOKEN`, `GHN_SHOP_ID` — lấy tài khoản test ở
  [5sao.ghn.dev](https://5sao.ghn.dev): đăng nhập → tab "Chủ cửa hàng" → "Xem" để copy
  Token → tab "Quản lý cửa hàng" điền địa chỉ shop để lấy ShopId. Tài khoản production lấy
  tương tự ở [khachhang.ghn.vn](https://khachhang.ghn.vn).
- `GHN_FROM_NAME`, `GHN_FROM_PHONE`, `GHN_FROM_ADDRESS`, `GHN_FROM_WARD_NAME`,
  `GHN_FROM_DISTRICT_NAME`, `GHN_FROM_PROVINCE_NAME` — địa chỉ **lấy hàng** (shop/kho của
  bạn). GHN nhận địa chỉ người **gửi** dạng tên tỉnh/quận/phường (text), khác với địa chỉ
  người **nhận** trong mỗi đơn — bắt buộc chọn theo mã GHN (3 select phụ thuộc ở form tạo
  đơn, gọi trực tiếp API GHN nên cũng cần `GHN_TOKEN` mới hoạt động được).
- `GHN_FROM_DISTRICT_ID` — **ID số** của quận/huyện lấy hàng (khác `GHN_FROM_DISTRICT_NAME`
  ở trên vốn là text) — 2 API "danh sách gói vận chuyển khả dụng" và "tính phí" bắt buộc
  nhận dạng ID, không nhận tên. Lấy ID bằng cách gọi thử API GHN
  `master-data/district?province_id=<id tỉnh>` hoặc xem trực tiếp trong trang quản lý shop
  GHN. Chưa điền thì phần chọn gói/xem giá ở bước "Tạo vận đơn GHN" báo lỗi rõ ràng, không
  chặn phần tạo vận đơn theo cách cũ nếu tự truyền được `serviceId`/`serviceTypeId` khác.

Chưa điền `GHN_*` thì `/admin/orders` vẫn xem/tạo đơn được (chỉ lưu nội bộ), riêng 3 select
địa chỉ người nhận và nút "Tạo vận đơn GHN" sẽ báo lỗi rõ ràng "chưa cấu hình", không crash
trang — không chặn tính năng khác.

Vòng đời 1 đơn: tạo đơn (nội bộ, chưa gọi GHN) → trang chi tiết đơn tự động gọi
`POST shipping-order/available-services` + `POST shipping-order/fee` cho từng gói khả dụng
trên tuyến giao, hiện danh sách gói kèm giá để chọn → "Tạo vận đơn GHN" (gọi
`POST shipping-order/create` với `service_id`/`service_type_id` đã chọn, lưu
`ghnOrderCode`/phí ship/dự kiến giao) → "Làm mới trạng thái GHN" (gọi
`POST shipping-order/detail`) → "Huỷ đơn" (gọi `POST switch-status/cancel` nếu đã có vận
đơn, rồi đánh dấu `CANCELLED` nội bộ dù GHN có gọi được hay không).

**Webhook trạng thái vận đơn (`/api/webhooks/ghn`)** — thay cho việc phải tự bấm "Làm mới
trạng thái GHN": GHN tự gọi endpoint này mỗi khi vận đơn đổi trạng thái (tài liệu:
`api.ghn.vn/home/docs/detail?id=47`). GHN không tự cấu hình được qua dashboard như SePay —
cần liên hệ GHN (qua form đối tác/tài khoản quản lý) để đăng ký Client ID + URL webhook +
môi trường (sandbox/production). Trỏ về
`https://<domain-production>/api/webhooks/ghn`.

⚠️ GHN không có cơ chế ký/xác thực request nào (không header token, không HMAC) — để giảm
rủi ro giả mạo, có thể đặt thêm `GHN_WEBHOOK_SECRET` (tuỳ chọn) trong `.env`, rồi đưa URL
kèm query `?key=<secret>` cho GHN thay vì URL trần. Chưa đặt biến này thì endpoint vẫn hoạt
động, chỉ là không xác thực được nguồn gọi.

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
tính năng tìm nhóm Facebook), `SEPAY_BANK_ACCOUNT`/`SEPAY_BANK_CODE`/
`SEPAY_ACCOUNT_HOLDER`/`SEPAY_WEBHOOK_API_KEY` (tùy chọn — chỉ cần nếu dùng nạp credit
qua SePay), `NEXT_PUBLIC_SITE_URL` (tùy chọn — domain đầy đủ dạng
`https://...`, dùng làm `metadataBase`/Open Graph khi chia sẻ sản phẩm ra Facebook/Zalo
(P1.2); chưa cấu hình thì code tự fallback về domain production hiện tại, xem
`src/lib/site.ts`).

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
- `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_HOLDER`, `SEPAY_WEBHOOK_API_KEY`
  — giống `.env` cục bộ, chỉ cần nếu dùng nạp credit qua SePay. Webhook SePay phải trỏ về
  `https://thanhly-dau-gia-hifen.vercel.app/api/webhooks/sepay`.
- `GHN_ENV`, `GHN_TOKEN`, `GHN_SHOP_ID`, `GHN_FROM_NAME`, `GHN_FROM_PHONE`,
  `GHN_FROM_ADDRESS`, `GHN_FROM_WARD_NAME`, `GHN_FROM_DISTRICT_NAME`,
  `GHN_FROM_PROVINCE_NAME`, `GHN_FROM_DISTRICT_ID` — giống `.env` cục bộ, chỉ cần nếu dùng
  tạo vận đơn GHN ở `/admin/orders`.
- `GHN_WEBHOOK_SECRET` — tuỳ chọn, xác thực webhook trạng thái vận đơn (GHN không có cơ
  chế ký request). Webhook phải trỏ về `https://thanhly-dau-gia-hifen.vercel.app/api/webhooks/ghn`
  (kèm `?key=<giá trị này>` nếu có đặt).
- `AUTH_SECRET` — **khác** giá trị dev, đã tạo mới bằng `openssl rand -base64 32` riêng
  cho production.
- `NEXT_PUBLIC_SITE_URL` — **chưa cấu hình trên Vercel** (25/08/2026); code tự fallback
  về đúng domain production ở trên nên chưa gây lỗi, nhưng nếu domain đổi thì phải set
  biến này thay vì sửa code (xem `src/lib/site.ts`).

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
