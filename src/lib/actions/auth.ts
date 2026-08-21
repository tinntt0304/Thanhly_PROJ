"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginFormState = { error?: string };

export async function loginAction(
  _prevState: LoginFormState | undefined,
  formData: FormData
): Promise<LoginFormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Email hoặc mật khẩu không đúng." };
    }
    throw e;
  }
  return {};
}
