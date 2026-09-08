import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  GraphApiError,
  exchangeCodeForUserToken,
  exchangeForLongLivedToken,
  listManagedPages,
} from "@/lib/facebook-graph";

const STATE_COOKIE = "fb_oauth_state";
const PAGES_COOKIE = "fb_oauth_pages";
const RETURN_PATH = "/admin/hop-thu-facebook";

function redirectWithError(request: Request, message: string) {
  const url = new URL(RETURN_PATH, request.url);
  url.searchParams.set("fb_error", message);
  const res = NextResponse.redirect(url);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

// Facebook redirect về đây sau khi seller cấp quyền (hoặc từ chối) ở màn OAuth. Đổi code lấy
// user access token -> đổi tiếp lấy bản dài hạn -> gọi /me/accounts lấy danh sách fanpage +
// Page Access Token của từng trang. 1 trang thì tự kết nối luôn; nhiều trang thì tạm lưu
// (cookie httpOnly ngắn hạn) để trang /admin/hop-thu-facebook hiện danh sách cho seller chọn
// (xem selectFacebookPage ở lib/actions/facebook-inbox.ts).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return redirectWithError(request, errorDescription);
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectWithError(request, "Phiên kết nối Facebook không hợp lệ hoặc đã hết hạn, vui lòng thử lại.");
  }

  const redirectUri = new URL("/api/auth/facebook/callback", request.url).toString();

  try {
    const shortLivedToken = await exchangeCodeForUserToken(code, redirectUri);
    const userToken = await exchangeForLongLivedToken(shortLivedToken);
    const pages = await listManagedPages(userToken);

    if (pages.length === 0) {
      return redirectWithError(
        request,
        "Không tìm thấy fanpage nào bạn quản lý, hoặc chưa cấp đủ quyền pages_show_list."
      );
    }

    if (pages.length === 1) {
      const page = pages[0];
      await prisma.facebookPageConnection.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken },
        update: { pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken },
      });
      const res = NextResponse.redirect(new URL(`${RETURN_PATH}?fb_connected=1`, request.url));
      res.cookies.delete(STATE_COOKIE);
      return res;
    }

    // Nhiều trang — tạm lưu để trang hiện danh sách cho seller chọn. Cookie chứa Page Access
    // Token thật (nhạy cảm) nên httpOnly + Secure (production) + TTL ngắn, xoá ngay sau khi
    // chọn xong (xem selectFacebookPage).
    const res = NextResponse.redirect(new URL(`${RETURN_PATH}?fb_pick=1`, request.url));
    res.cookies.set(PAGES_COOKIE, JSON.stringify(pages), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    const message = e instanceof GraphApiError ? e.message : "Kết nối Facebook thất bại, vui lòng thử lại.";
    return redirectWithError(request, message);
  }
}
