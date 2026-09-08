"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "admin_onboarding_seen";
const PADDING = 6;

type Step = {
  target: string;
  href: string;
  title: string;
  description: string;
};

const sellerSteps: Step[] = [
  {
    target: "admin",
    href: "/admin",
    title: "Danh sách sản phẩm",
    description: "Trang chủ quản trị — nơi bạn xem toàn bộ sản phẩm đã đăng và tình trạng bán của từng sản phẩm.",
  },
  {
    target: "products-new",
    href: "/admin/products/new",
    title: "Đăng sản phẩm",
    description: "Thêm sản phẩm mới lên sàn: hình ảnh, giá bán, mô tả, danh mục.",
  },
  {
    target: "product-form-submit",
    href: "/admin/products/new",
    title: "Nút Đăng sản phẩm",
    description: "Điền xong thông tin thì bấm nút này để đăng sản phẩm lên sàn.",
  },
  {
    target: "products-import",
    href: "/admin/products/import",
    title: "Import Excel",
    description: "Đăng hàng loạt sản phẩm nhanh chóng bằng cách nhập từ file Excel.",
  },
  {
    target: "import-file",
    href: "/admin/products/import",
    title: "Chọn file Excel",
    description: "Chọn file Excel đã điền theo mẫu để chuẩn bị import.",
  },
  {
    target: "import-submit",
    href: "/admin/products/import",
    title: "Nút Import",
    description: "Bấm để đăng hàng loạt các sản phẩm trong file đã chọn.",
  },
  {
    target: "gallery",
    href: "/admin/thu-vien-anh",
    title: "Thư viện ảnh",
    description: "Lưu trữ và tái sử dụng ảnh sản phẩm cho nhiều lần đăng bán khác nhau.",
  },
  {
    target: "gallery-choose-file",
    href: "/admin/thu-vien-anh",
    title: "Chọn tệp",
    description: "Chọn 1 hoặc nhiều ảnh từ máy để tải lên thư viện.",
  },
  {
    target: "gallery-upload",
    href: "/admin/thu-vien-anh",
    title: "Tải ảnh lên",
    description: "Bấm để tải các ảnh vừa chọn lên thư viện, dùng lại cho nhiều sản phẩm.",
  },
  {
    target: "orders",
    href: "/admin/orders",
    title: "Quản lý đơn hàng",
    description: "Theo dõi trạng thái giao hàng, xử lý và huỷ đơn hàng của khách.",
  },
  {
    target: "facebook-groups",
    href: "/admin/nhom-facebook",
    title: "Tìm nhóm Facebook",
    description: "Tìm nhóm Facebook phù hợp và soạn sẵn nội dung để đăng bán sản phẩm.",
  },
  {
    target: "facebook-keywords",
    href: "/admin/nhom-facebook",
    title: "Ô nhập từ khoá",
    description: "Nhập từ khoá liên quan đến sản phẩm để tìm nhóm Facebook phù hợp.",
  },
  {
    target: "facebook-search",
    href: "/admin/nhom-facebook",
    title: "Nút Tìm kiếm",
    description: "Bấm để tìm nhóm Facebook theo từ khoá vừa nhập.",
  },
];

const adminSteps: Step[] = [
  {
    target: "categories",
    href: "/admin/danh-muc",
    title: "Quản lý danh mục",
    description: "Tạo và sắp xếp danh mục sản phẩm cho toàn sàn.",
  },
  {
    target: "trust",
    href: "/admin/settings",
    title: "Bằng chứng uy tín",
    description: "Quản lý các bằng chứng, đánh giá giúp tăng độ tin cậy của sàn.",
  },
  {
    target: "trust-save",
    href: "/admin/settings",
    title: "Nút Lưu",
    description: "Bấm để lưu lại nội dung bằng chứng uy tín vừa chỉnh sửa.",
  },
  {
    target: "chat",
    href: "/admin/chat",
    title: "Chat hỗ trợ",
    description: "Trả lời tin nhắn hỗ trợ từ khách hàng và người bán trên sàn.",
  },
  {
    target: "chat-input",
    href: "/admin/chat",
    title: "Ô nhập tin nhắn",
    description: "Chọn 1 cuộc trò chuyện ở danh sách bên trái rồi nhập nội dung trả lời ở đây.",
  },
  {
    target: "chat-send",
    href: "/admin/chat",
    title: "Nút Gửi",
    description: "Bấm để gửi tin nhắn trả lời cho khách.",
  },
];

const accountStep: Step = {
  target: "account",
  href: "/admin/account",
  title: "Tài khoản của tôi",
  description: "Cập nhật thông tin tài khoản, nạp credit và xem trang công khai của bạn ở đây.",
};

const accountSaveStep: Step = {
  target: "account-save",
  href: "/admin/account",
  title: "Nút Lưu thay đổi",
  description: "Bấm để lưu lại thông tin tài khoản vừa chỉnh sửa.",
};

type Rect = { top: number; left: number; width: number; height: number };

export function OnboardingTour({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [positioned, setPositioned] = useState(false);

  const steps = [...sellerSteps, ...(isSuperAdmin ? adminSteps : []), accountStep, accountSaveStep];
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  // Mỗi bước tự chuyển sang đúng trang của tính năng đang giới thiệu (không chỉ trỏ vào
  // sidebar) — để người dùng thấy tính năng thật đằng sau spotlight thay vì đứng yên 1 trang.
  useEffect(() => {
    if (!open) return;
    if (pathname !== step.href) {
      router.push(step.href);
    }
  }, [open, step.href, pathname, router]);

  // Đọc localStorage lúc mount để quyết định có hiện tour hay không — đồng bộ hoá 1 lần
  // duy nhất với hệ thống bên ngoài (trình duyệt), không có gì để await.
  useLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nhánh đồng bộ hợp lệ của việc khởi tạo 1 lần lúc mount
    setOpen(true);
  }, []);

  // Mục tiêu của các bước con nằm trong nội dung trang (không phải sidebar cố định) — sau khi
  // router.push() sang trang mới, nội dung có thể chưa kịp render xong lúc bước này bắt đầu đo
  // (đặc biệt lần đầu Next.js biên dịch route). Thử lại vài lần trước khi coi là "không có" (vd.
  // ô nhập chat khi chưa chọn cuộc trò chuyện nào) và rơi về hiển thị giữa màn hình.
  useLayoutEffect(() => {
    if (!open) return;

    let rafId: number | undefined;
    let attempts = 0;
    let firstAttempt = true;
    const MAX_ATTEMPTS = 200;

    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        // Xoá highlight cũ ngay (thay vì giữ vị trí sai của bước trước) trong lúc chờ trang
        // mới render xong — chỉ cần setRect(null) 1 lần, không phải mỗi khung hình.
        if (firstAttempt) setRect(null);
        firstAttempt = false;
        if (attempts < MAX_ATTEMPTS) {
          attempts++;
          rafId = requestAnimationFrame(measure);
        }
        return;
      }
      firstAttempt = false;
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step.target]);

  useLayoutEffect(() => {
    if (!tooltipRef.current) return;
    const tw = tooltipRef.current.offsetWidth;
    const th = tooltipRef.current.offsetHeight;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Không tìm thấy phần tử (đang chờ trang render, hoặc phần tử có điều kiện như ô nhập chat
    // khi chưa chọn cuộc trò chuyện) — vẫn hiện hộp thoại, chỉ là ở giữa màn hình, không kẹt ẩn.
    if (!rect) {
      setTooltipStyle({ top: vh / 2 - th / 2, left: vw / 2 - tw / 2 });
      setPositioned(true);
      return;
    }

    let top: number;
    let left: number;

    if (rect.left + rect.width + margin + tw <= vw) {
      left = rect.left + rect.width + margin;
      top = rect.top;
    } else if (rect.top + rect.height + margin + th <= vh) {
      left = rect.left;
      top = rect.top + rect.height + margin;
    } else {
      left = rect.left;
      top = rect.top - th - margin;
    }

    left = Math.min(Math.max(left, margin), vw - tw - margin);
    top = Math.min(Math.max(top, margin), vh - th - margin);
    setTooltipStyle({ top, left });
    setPositioned(true);
  }, [rect]);

  if (!open) return null;

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // bỏ qua nếu không lưu được — vẫn đóng tour cho phiên hiện tại
    }
    setOpen(false);
  }

  const highlight = rect
    ? {
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : null;

  return (
    <>
      {highlight && (
        <>
          <div
            className="fixed z-40 bg-black/55"
            style={{ top: 0, left: 0, right: 0, height: Math.max(highlight.top, 0) }}
          />
          <div
            className="fixed z-40 bg-black/55"
            style={{ top: highlight.top + highlight.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="fixed z-40 bg-black/55"
            style={{ top: highlight.top, left: 0, width: Math.max(highlight.left, 0), height: highlight.height }}
          />
          <div
            className="fixed z-40 bg-black/55"
            style={{ top: highlight.top, left: highlight.left + highlight.width, right: 0, height: highlight.height }}
          />
          <div
            className="pointer-events-none fixed z-40 rounded-md ring-2 ring-accent-500"
            style={{ top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
          />
        </>
      )}
      {!highlight && <div className="fixed inset-0 z-40 bg-black/55" />}

      <div
        ref={tooltipRef}
        className="fixed z-50 w-80 rounded-lg bg-surface p-4 shadow-xl"
        style={{ top: tooltipStyle.top, left: tooltipStyle.left, visibility: positioned ? "visible" : "hidden" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-heading text-sm font-bold text-text">{step.title}</h3>
          <span className="text-xs text-neutral-500">
            {stepIndex + 1}/{steps.length}
          </span>
        </div>
        <p className="text-sm text-neutral-700">{step.description}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="whitespace-nowrap rounded text-xs text-neutral-500 hover:text-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            Không cần hướng dẫn
          </button>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              className="whitespace-nowrap rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
              className="whitespace-nowrap rounded-md bg-accent-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:ring-offset-1"
            >
              {isLast ? "Bắt đầu sử dụng" : "Tiếp theo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
