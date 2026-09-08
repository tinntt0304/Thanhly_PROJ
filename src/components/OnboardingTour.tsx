"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildTourSteps } from "@/lib/admin-wiki-content";

const STORAGE_KEY = "admin_onboarding_seen";
const PADDING = 6;

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

  const steps = useMemo(() => buildTourSteps(isSuperAdmin), [isSuperAdmin]);
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

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={finish}
            className="self-start whitespace-nowrap rounded text-xs text-neutral-500 hover:text-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            Không cần hướng dẫn
          </button>
          <div className="flex justify-end gap-2">
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
