import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone };
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: ({ token, user, trigger, session }) => {
      if (user) {
        token.role = user.role;
        token.phone = user.phone ?? null;
      }
      // JWT chỉ được điền từ `user` lúc đăng nhập, sau đó nằm im trong cookie — sửa tên/SĐT ở
      // trang tài khoản chỉ đổi DB, không tự đổi cookie. unstable_update() (actions/account.ts)
      // gọi lại đây với trigger "update" để đồng bộ ngay, khỏi cần đăng xuất/đăng nhập lại.
      if (trigger === "update" && session) {
        if (typeof session.user?.name === "string") token.name = session.user.name;
        if (session.user && "phone" in session.user) token.phone = session.user.phone ?? null;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
        session.user.phone = token.phone ?? null;
      }
      return session;
    },
  },
  trustHost: true,
});
