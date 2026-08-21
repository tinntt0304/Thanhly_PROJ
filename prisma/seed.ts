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

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
  console.log(`Admin sẵn sàng: ${admin.email}`);

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
