import { AUCTION_STATE_LABEL, type AuctionState } from "@/lib/auction";

const STYLES: Record<AuctionState, string> = {
  BIDDING: "bg-green-100 text-green-800",
  ENDED_AWAITING_CONTACT: "bg-amber-100 text-amber-800",
  UNSOLD: "bg-neutral-200 text-neutral-700",
  SOLD: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-700",
};

export function StatusBadge({ state }: { state: AuctionState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[state]}`}
    >
      {AUCTION_STATE_LABEL[state]}
    </span>
  );
}
