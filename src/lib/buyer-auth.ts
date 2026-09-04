import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const isProd = process.env.NODE_ENV === "production";

// Instance NextAuth ĐỘC LẬP thứ 2, riêng cho người mua — không dùng chung với src/lib/auth.ts
// (dành cho User: SUPERADMIN/SELLER) vì role model khác hẳn (Buyer không có role). basePath +
// tên cookie riêng ("buyer-session-token", khác "authjs.session-token" mặc định của auth.ts) để
// 2 session (admin và buyer) tồn tại độc lập trên cùng trình duyệt, không đè lên nhau.
//
// Kiểu trả về của authorize()/callbacks bị ràng buộc bởi module augmentation dùng CHUNG cho cả
// 2 instance (declare module "next-auth" ở src/next-auth.d.ts, gắn cho User admin, yêu cầu
// field `role`) — cast cục bộ trong file này thay vì fabricate 1 role giả cho buyer; phần còn
// lại của app chỉ thấy được kiểu BuyerSession sạch qua buyerAuth()/getBuyerSession() bên dưới,
// không bao giờ đụng trực tiếp session thô của next-auth.
const {
  handlers: buyerHandlers,
  auth: rawBuyerAuth,
  signIn: buyerSignIn,
  signOut: buyerSignOut,
} = NextAuth({
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Số điện thoại" },
        password: { label: "Mật khẩu", type: "password" },
      },
      authorize: async (credentials) => {
        const phone = credentials?.phone;
        const password = credentials?.password;
        if (typeof phone !== "string" || typeof password !== "string") return null;

        const buyer = await prisma.buyer.findUnique({ where: { phone } });
        if (!buyer) return null;

        const isValid = await bcrypt.compare(password, buyer.passwordHash);
        if (!isValid) return null;

        return { id: buyer.id, name: buyer.name, phone: buyer.phone } as unknown as {
          id: string;
          name: string;
          role: never;
        };
      },
    }),
  ],
  pages: {
    signIn: "/dang-nhap",
  },
  session: {
    strategy: "jwt",
  },
  basePath: "/api/buyer-auth",
  cookies: {
    sessionToken: {
      name: isProd ? "__Secure-buyer-session-token" : "buyer-session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
      },
    },
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        (token as unknown as { phone?: string }).phone = (user as unknown as { phone: string }).phone;
        token.name = user.name;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        (session.user as unknown as { phone?: string }).phone = (token as unknown as { phone?: string }).phone;
      }
      return session;
    },
  },
  trustHost: true,
});

export type BuyerSession = { user: { id: string; name: string; phone: string } };

// Bọc lại session thô của NextAuth thành kiểu sạch riêng cho buyer — xem giải thích ở đầu file.
export async function buyerAuth(): Promise<BuyerSession | null> {
  const session = await rawBuyerAuth();
  if (!session?.user?.id) return null;
  const phone = (session.user as unknown as { phone?: string }).phone;
  if (!phone) return null;
  return { user: { id: session.user.id, name: session.user.name ?? "", phone } };
}

export { buyerHandlers, buyerSignIn, buyerSignOut };
