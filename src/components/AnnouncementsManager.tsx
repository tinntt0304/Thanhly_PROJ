"use client";

import { useActionState } from "react";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePublishAnnouncement,
  type AnnouncementFormState,
} from "@/lib/actions/announcements";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

type AnnouncementData = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  createdAt: string;
};

const initialState: AnnouncementFormState = {};

function AnnouncementEditForm({ item }: { item: AnnouncementData }) {
  const [state, formAction, pending] = useActionState(
    updateAnnouncement.bind(null, item.id),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-neutral-500">
          Đăng ngày {new Date(item.createdAt).toLocaleDateString("vi-VN")} —{" "}
          {item.published ? "Đang hiển thị" : "Đã ẩn"}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void togglePublishAnnouncement(item.id, !item.published);
            }}
            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            {item.published ? "Ẩn" : "Hiển thị lại"}
          </button>
          <button
            type="button"
            onClick={() => {
              void deleteAnnouncement(item.id);
            }}
            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Xoá
          </button>
        </div>
      </div>
      <input name="title" defaultValue={item.title} required className={inputClass} />
      <textarea name="content" defaultValue={item.content} rows={3} required className={inputClass} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

function AnnouncementCreateForm() {
  const [state, formAction, pending] = useActionState(createAnnouncement, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-dashed border-neutral-300 p-3">
      <input name="title" placeholder="Tiêu đề thông báo" required className={inputClass} />
      <textarea name="content" placeholder="Nội dung..." rows={3} required className={inputClass} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "Đang đăng..." : "+ Đăng thông báo mới"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function AnnouncementsManager({ items }: { items: AnnouncementData[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <AnnouncementEditForm key={item.id} item={item} />
      ))}
      <AnnouncementCreateForm />
    </div>
  );
}
