# Thanh Lý Kiểu Đấu Giá

Trang thanh lý sản phẩm kiểu đấu giá — người bán đăng sản phẩm, người mua trả giá
bằng SĐT (không cần tài khoản). Xem đầy đủ yêu cầu ở [docs/PRD.md](docs/PRD.md).

Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL + NextAuth.

## Bắt đầu

Xem hướng dẫn chi tiết ở [docs/SETUP.md](docs/SETUP.md) (cài đặt, chạy dev, tài khoản
admin mặc định, cách deploy).

Tóm tắt nhanh:

```bash
npm install
npx prisma dev -d          # DB Postgres cục bộ cho dev (chỉ cần làm 1 lần / khi máy khởi động lại)
npx prisma migrate dev     # áp schema
npx prisma db seed         # tạo tài khoản admin + trust profile mặc định
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) — trang công khai. Đăng nhập người
bán tại `/admin/login`.

## Cấu trúc chính

- `docs/PRD.md` — yêu cầu sản phẩm (nguồn sự thật cho phạm vi v1).
- `docs/SETUP.md` — hướng dẫn cài đặt & vận hành.
- `prisma/schema.prisma` — mô hình dữ liệu (Product, Bid, Admin, TrustProfile).
- `src/lib/auction.ts` — logic đấu giá dùng chung (suy ra trạng thái phiên, ẩn SĐT, format tiền).
- `src/lib/actions/` — Server Actions cho mutation (trả giá, đăng/sửa sản phẩm, đăng nhập, uy tín).
- `src/app/` — các trang: trang chủ, chi tiết sản phẩm, khu vực `/admin` (yêu cầu đăng nhập).
