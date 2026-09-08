"use client";

import { useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "admin_onboarding_seen";
const PADDING = 6;

type Step = {
  target: string;
  title: string;
  description: string;
};

const sellerSteps: Step[] = [
  {
    target: "admin",
    title: "Danh sách sản phẩm",
    description: "Trang chủ quản trị — nơi bạn xem toàn bộ sản phẩm đã đăng và tình trạng bán của từng sản phẩm.",
  },
  {
    target: "products-new",
    title: "Đăng sản phẩm",
    description: "Thêm sản phẩm mới lên sàn: hình ảnh, giá bán, mô tả, danh mục.",
  },
  {
    target: "products-import",
    title: "Import Excel",
    description: "Đăng hàng loạt sản phẩm nhanh chóng bằng cách nhập từ file Excel.",
  },
  {
    target: "gallery",
    title: "Thư viện ảnh",
    description: "Lưu trữ và tái sử dụng ảnh sản phẩm cho nhiều lần đăng bán khác nhau.",
  },
  {
    target: "orders",
    title: "Quản lý đơn hàng",
    description: "Theo dõi trạng thái giao hàng, xử lý và huỷ đơn hàng của khách.",
  },
  {
    target: "facebook-groups",
    title: "Tìm nhóm Facebook",
    description: "Tìm nhóm Facebook phù hợp và soạn sẵn nội dung để đăng bán sản phẩm.",
  },
];

const adminSteps: Step[] = [
  {
    target: "categories",
    title: "Quản lý danh mục",
    description: "Tạo và sắp xếp danh mục sản phẩm cho toàn sàn.",
  },
  {
    target: "trust",
    title: "Bằng chứng uy tín",
    description: "Quản lý các bằng chứng, đánh giá giúp tăng độ tin cậy của sàn.",
  },
  {
    target: "chat",
    title: "Chat hỗ trợ",
    description: "Trả lời tin nhắn hỗ trợ từ khách hàng và người bán trên sàn.",
  },
];

const accountStep: Step = {
  target: "account",
  title: "Tài khoản của tôi",
  description: "Cập nhật thông tin tài khoản, nạp credit và xem trang công khai của bạn ở đây.",
};

type Rect = { top: number; left: number; width: number; height: number };

export function OnboardingTour({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const steps = [...sellerSteps, ...(isSuperAdmin ? adminSteps : []), accountStep];
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

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

  useLayoutEffect(() => {
    if (!open) return;

    function measure() {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step.target]);

  useLayoutEffect(() => {
    if (!rect || !tooltipRef.current) return;
    const tw = tooltipRef.current.offsetWidth;
    const th = tooltipRef.current.offsetHeight;
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

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
        style={{ top: tooltipStyle.top, left: tooltipStyle.left, visibility: rect ? "visible" : "hidden" }}
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
