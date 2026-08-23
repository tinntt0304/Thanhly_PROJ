"use client";

import { useActionState } from "react";
import { updateSiteContent, type SiteContentFormState } from "@/lib/actions/site-content";

const initialState: SiteContentFormState = {};

export function AboutContentEditor({ content }: { content: string }) {
  const [state, formAction, pending] = useActionState(
    updateSiteContent.bind(null, "about_us"),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="content"
        defaultValue={content}
        rows={8}
        required
        className="rounded-md border border-neutral-300 bg-surface px-3 py-2 text-sm text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
      >
        {pending ? "Đang lưu..." : "Lưu nội dung"}
      </button>
    </form>
  );
}
