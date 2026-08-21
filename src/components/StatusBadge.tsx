import { AUCTION_STATE_LABEL, type AuctionState } from "@/lib/auction";

const STYLES: Record<AuctionState, string> = {
  BIDDING: "bg-accent-2-100 text-accent-2-700",
  ENDED_AWAITING_CONTACT: "bg-accent-100 text-accent-700",
  UNSOLD: "bg-neutral-200 text-neutral-700",
  SOLD: "bg-neutral-800 text-neutral-50",
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
