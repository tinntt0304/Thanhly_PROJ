import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  GraphApiError,
  exchangeCodeForUserToken,
  exchangeForLongLivedToken,
  listManagedPages,
} from "@/lib/facebook-graph";
import { connectFacebookPage } from "@/lib/facebook-inbox-store";

const STATE_COOKIE = "fb_oauth_state";
const PAGES_COOKIE = "fb_oauth_pages";
// Cấu hình kết nối fanpage sống ở /admin/cai-dat (xem FacebookConnectionSettings.tsx) — trang
// Hộp thư Facebook (/admin/hop-thu-facebook) giờ chỉ còn hiển thị hội thoại/bình luận.
const RETURN_PATH = "/admin/cai-dat";

function redirectWithError(request: Request, message: string) {
  const url = new URL(RETURN_PATH, request.url);
  url.searchParams.set("fb_error", message);
  const res = NextResponse.redirect(url);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

// Facebook redirect về đây sau khi seller cấp quyền (hoặc từ chối) ở màn OAuth. Đổi code lấy
// user access token -> đổi tiếp lấy bản dài hạn -> gọi /me/accounts lấy danh sách fanpage +
// Page Access Token của từng trang -> LỌC BỎ những trang seller đã kết nối rồi (seller có thể
// chạy lại OAuth nhiều lần để THÊM fanpage mới, không phải chỉ để thay 1 fanpage duy nhất
// nữa — xem FacebookPageConnection ở schema.prisma, 1 seller giờ kết nối được nhiều trang).
// Còn đúng 1 trang MỚI thì tự kết nối luôn; nhiều trang mới thì tạm lưu (cookie httpOnly ngắn
// hạn) để /admin/cai-dat hiện danh sách cho seller chọn (hỗ trợ chọn nhiều, xem
// selectFacebookPage ở lib/actions/facebook-inbox.ts).
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
    const allPages = await listManagedPages(userToken);

    if (allPages.length === 0) {
      return redirectWithError(
        request,
        "Không tìm thấy fanpage nào bạn quản lý, hoặc chưa cấp đủ quyền pages_show_list."
      );
    }

    const alreadyConnected = await prisma.facebookPageConnection.findMany({
      where: { userId: session.user.id },
      select: { pageId: true },
    });
    const connectedIds = new Set(alreadyConnected.map((c) => c.pageId));
    const newPages = allPages.filter((p) => !connectedIds.has(p.id));

    if (newPages.length === 0) {
      const url = new URL(`${RETURN_PATH}?fb_info=all_connected`, request.url);
      url.searchParams.set("fb_total", String(allPages.length));
      const res = NextResponse.redirect(url);
      res.cookies.delete(STATE_COOKIE);
      return res;
    }

    if (newPages.length === 1) {
      await connectFacebookPage(session.user.id, newPages[0]);
      const url = new URL(`${RETURN_PATH}?fb_connected=1`, request.url);
      url.searchParams.set("fb_total", String(allPages.length));
      const res = NextResponse.redirect(url);
      res.cookies.delete(STATE_COOKIE);
      return res;
    }

    // Nhiều trang mới — tạm lưu để trang hiện danh sách cho seller chọn (chọn được nhiều).
    // Cookie chứa Page Access Token thật (nhạy cảm) nên httpOnly + Secure (production) + TTL
    // ngắn, xoá ngay sau khi seller bấm "Xong" (xem clearPendingFacebookPages).
    // fb_total = tổng số trang Graph API /me/accounts trả về (không lọc) — hiện ra để seller tự
    // đối chiếu với số fanpage thật mình quản lý, phát hiện ngay nếu Facebook chỉ cấp quyền một
    // phần (thường do app chưa qua App Review / Business Verification, không phải lỗi ở app).
    const pickUrl = new URL(`${RETURN_PATH}?fb_pick=1`, request.url);
    pickUrl.searchParams.set("fb_total", String(allPages.length));
    const res = NextResponse.redirect(pickUrl);
    res.cookies.set(PAGES_COOKIE, JSON.stringify(newPages), {
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
