"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "admin_onboarding_seen";

type Step = {
  title: string;
  description: string;
  icon: string;
};

const sellerSteps: Step[] = [
  {
    icon: "🛍️",
    title: "Danh sách sản phẩm",
    description: "Trang chủ quản trị — nơi bạn xem toàn bộ sản phẩm đã đăng và tình trạng bán của từng sản phẩm.",
  },
  {
    icon: "➕",
    title: "Đăng sản phẩm",
    description: "Thêm sản phẩm mới lên sàn: hình ảnh, giá bán, mô tả, danh mục.",
  },
  {
    icon: "📥",
    title: "Import Excel",
    description: "Đăng hàng loạt sản phẩm nhanh chóng bằng cách nhập từ file Excel.",
  },
  {
    icon: "🖼️",
    title: "Thư viện ảnh",
    description: "Lưu trữ và tái sử dụng ảnh sản phẩm cho nhiều lần đăng bán khác nhau.",
  },
  {
    icon: "📦",
    title: "Quản lý đơn hàng",
    description: "Theo dõi trạng thái giao hàng, xử lý và huỷ đơn hàng của khách.",
  },
  {
    icon: "🔍",
    title: "Tìm nhóm Facebook",
    description: "Tìm nhóm Facebook phù hợp và soạn sẵn nội dung để đăng bán sản phẩm.",
  },
];

const adminSteps: Step[] = [
  {
    icon: "📋",
    title: "Quản lý danh mục",
    description: "Tạo và sắp xếp danh mục sản phẩm cho toàn sàn.",
  },
  {
    icon: "⭐",
    title: "Bằng chứng uy tín",
    description: "Quản lý các bằng chứng, đánh giá giúp tăng độ tin cậy của sàn.",
  },
  {
    icon: "💬",
    title: "Chat hỗ trợ",
    description: "Trả lời tin nhắn hỗ trợ từ khách hàng và người bán trên sàn.",
  },
];

const accountStep: Step = {
  icon: "👤",
  title: "Tài khoản của tôi",
  description: "Cập nhật thông tin tài khoản, nạp credit và xem trang công khai của bạn bất cứ lúc nào ở cuối menu bên trái.",
};

export function OnboardingTour({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage không khả dụng (chế độ riêng tư...) — bỏ qua tour thay vì lỗi trang
    }
  }, []);

  if (!open) return null;

  const steps = [...sellerSteps, ...(isSuperAdmin ? adminSteps : []), accountStep];
  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // bỏ qua nếu không lưu được — vẫn đóng tour cho phiên hiện tại
    }
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-text">Hướng dẫn sử dụng</h2>
          <span className="text-xs text-neutral-500">
            Bước {stepIndex + 1}/{steps.length}
          </span>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-lg bg-neutral-50 px-4 py-6 text-center">
          <span className="text-3xl">{step.icon}</span>
          <h3 className="font-heading text-base font-bold text-text">{step.title}</h3>
          <p className="text-sm text-neutral-700">{step.description}</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-neutral-500 hover:text-text hover:underline"
          >
            Không cần hướng dẫn
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Quay lại
            </button>
            <button
              type="button"
              onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
              className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-600"
            >
              {isLast ? "Bắt đầu sử dụng" : "Tiếp theo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
