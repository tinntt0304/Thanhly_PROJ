import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

// next-auth/jwt chỉ re-export từ @auth/core/jwt ("export * from") — augment module
// gốc @auth/core/jwt mới thực sự merge vào type JWT dùng trong callback `jwt`.
declare module "@auth/core/jwt" {
  interface JWT {
    role: UserRole;
  }
}
