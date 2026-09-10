import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { FACEBOOK_OAUTH_SCOPES } from "@/lib/facebook-graph";

const STATE_COOKIE = "fb_oauth_state";

// Bấm "Kết nối với Facebook" ở /admin/cai-dat đi tới đây — sinh state chống CSRF,
// lưu vào cookie httpOnly ngắn hạn, rồi điều hướng sang màn cấp quyền của Facebook cho đúng
// Meta App của chủ sàn (FACEBOOK_APP_ID). redirect_uri tính TỪ chính request hiện tại (không
// dùng NEXT_PUBLIC_SITE_URL cố định) để hoạt động đúng ở mọi môi trường (dev/preview/prod) —
// nhưng seller cần đăng ký ĐÚNG URL này (theo domain đang chạy) vào "Valid OAuth Redirect
// URIs" ở Meta App Dashboard trước, nếu không Facebook sẽ từ chối redirect.
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) {
    const url = new URL("/admin/cai-dat", request.url);
    url.searchParams.set("fb_error", "Chưa cấu hình FACEBOOK_APP_ID — liên hệ quản trị viên để hoàn tất thiết lập.");
    return NextResponse.redirect(url);
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/facebook/callback", request.url).toString();

  const authorizeUrl = new URL(`https://www.facebook.com/${process.env.FACEBOOK_GRAPH_API_VERSION || "v21.0"}/dialog/oauth`);
  authorizeUrl.searchParams.set("client_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", FACEBOOK_OAUTH_SCOPES);
  authorizeUrl.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
