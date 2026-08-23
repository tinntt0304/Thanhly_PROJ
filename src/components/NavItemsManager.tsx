"use client";

import { useActionState } from "react";
import {
  createNavItem,
  updateNavItem,
  deleteNavItem,
  type NavItemFormState,
} from "@/lib/actions/nav";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-2 py-1.5 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

type NavItemData = { id: string; label: string; href: string; order: number };

const initialState: NavItemFormState = {};

function NavItemEditForm({ item }: { item: NavItemData }) {
  const [state, formAction, pending] = useActionState(
    updateNavItem.bind(null, item.id),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-neutral-200 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Tên hiển thị</label>
        <input name="label" defaultValue={item.label} required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Đường dẫn</label>
        <input name="href" defaultValue={item.href} required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Thứ tự</label>
        <input name="order" type="number" defaultValue={item.order} className={`w-20 ${inputClass}`} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu"}
      </button>
      <button
        type="button"
        onClick={() => {
          void deleteNavItem(item.id);
        }}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Xoá
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

function NavItemCreateForm({ nextOrder }: { nextOrder: number }) {
  const [state, formAction, pending] = useActionState(createNavItem, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-neutral-300 p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Tên hiển thị</label>
        <input name="label" placeholder="vd. Chính sách đổi trả" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Đường dẫn</label>
        <input name="href" placeholder="/chinh-sach" required className={inputClass} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-neutral-600">Thứ tự</label>
        <input name="order" type="number" defaultValue={nextOrder} className={`w-20 ${inputClass}`} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Đang thêm..." : "+ Thêm mục menu"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function NavItemsManager({ items }: { items: NavItemData[] }) {
  const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 1;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-600">
        &ldquo;Trang chủ&rdquo; luôn cố định đứng đầu menu, không hiện ở đây. Các mục bên dưới hiển
        thị theo thứ tự tăng dần.
      </p>
      {items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((item) => (
          <NavItemEditForm key={item.id} item={item} />
        ))}
      <NavItemCreateForm nextOrder={nextOrder} />
    </div>
  );
}
