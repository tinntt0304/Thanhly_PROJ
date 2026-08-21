import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}
