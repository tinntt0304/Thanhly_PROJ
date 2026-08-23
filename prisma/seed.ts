import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Thiếu ADMIN_EMAIL / ADMIN_PASSWORD trong .env — cần khai báo trước khi seed."
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const superadmin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: "Quản trị viên", role: "SUPERADMIN" },
  });
  console.log(`Superadmin sẵn sàng: ${superadmin.email}`);

  const existingTrustProfile = await prisma.trustProfile.findFirst();
  if (!existingTrustProfile) {
    await prisma.trustProfile.create({
      data: {
        avgRating: 4.8,
        soldCount: 0,
        reviews: [],
      },
    });
    console.log("Đã tạo TrustProfile mặc định — cập nhật nội dung qua trang /admin/settings.");
  }

  const existingNavItems = await prisma.navItem.count();
  if (existingNavItems === 0) {
    await prisma.navItem.createMany({
      data: [
        { label: "Thông báo & Tin tức", href: "/thong-bao", order: 1 },
        { label: "Về chúng tôi", href: "/ve-chung-toi", order: 2 },
      ],
    });
    console.log("Đã tạo menu điều hướng mặc định — chỉnh sửa qua /admin/danh-muc.");
  }

  const existingAboutContent = await prisma.siteContent.findUnique({ where: { key: "about_us" } });
  if (!existingAboutContent) {
    await prisma.siteContent.create({
      data: {
        key: "about_us",
        content:
          "hifen là sàn thanh lý đồ mẹ & bé, thú cưng theo hình thức đấu giá trực tuyến — " +
          "giúp người mua tìm được sản phẩm tốt với giá hợp lý, và người bán dễ dàng đăng " +
          "sản phẩm để thanh lý nhanh chóng, minh bạch.",
      },
    });
    console.log('Đã tạo nội dung "Về chúng tôi" mặc định — chỉnh sửa qua /admin/danh-muc.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
