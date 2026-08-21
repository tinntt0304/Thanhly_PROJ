import { AdminChatPanel } from "@/components/AdminChatPanel";

export default function AdminChatPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-lg font-bold text-text">Chat hỗ trợ khách</h1>
      <AdminChatPanel />
    </div>
  );
}
