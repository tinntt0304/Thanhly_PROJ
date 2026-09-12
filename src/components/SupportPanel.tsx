"use client";

import { useState } from "react";
import { AdminChatPanel } from "@/components/AdminChatPanel";
import { SupportInboxPanel } from "@/components/SupportInboxPanel";

type Tab = "customers" | "sellers";

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent-500 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
      }`}
    >
      {children}
      {count > 0 && (
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium ${
            active ? "bg-white/25 text-white" : "bg-accent-500 text-white"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// Gộp "Chat hỗ trợ" (khách vãng lai công khai, /admin/chat cũ) và "Hỗ trợ" (seller <->
// superadmin) thành 1 trang duy nhất /admin/ho-tro cho superadmin — 2 đối tượng khác nhau
// (khách chưa có tài khoản vs seller đã đăng nhập) nên vẫn giữ 2 component/luồng dữ liệu riêng
// (AdminChatPanel, SupportInboxPanel), chỉ gộp chỗ điều hướng bằng tab để đỡ chiếm 2 mục sidebar.
export function SupportPanel({
  initialCustomerCount,
  initialSellerCount,
}: {
  initialCustomerCount: number;
  initialSellerCount: number;
}) {
  const [tab, setTab] = useState<Tab>(initialCustomerCount >= initialSellerCount ? "customers" : "sellers");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <TabButton active={tab === "customers"} count={initialCustomerCount} onClick={() => setTab("customers")}>
          Khách hàng
        </TabButton>
        <TabButton active={tab === "sellers"} count={initialSellerCount} onClick={() => setTab("sellers")}>
          Người bán
        </TabButton>
      </div>
      {tab === "customers" ? <AdminChatPanel /> : <SupportInboxPanel />}
    </div>
  );
}
