import { prisma } from "@/lib/prisma";
import { reviewsToText, type Review } from "@/lib/reviews";
import { TrustProfileForm } from "@/components/TrustProfileForm";

export default async function AdminSettingsPage() {
  const trustProfile = await prisma.trustProfile.findFirst();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Bằng chứng uy tín (hiển thị ở trang chủ)</h1>
      <TrustProfileForm
        avgRating={trustProfile?.avgRating ?? 5}
        soldCount={trustProfile?.soldCount ?? 0}
        reviewsText={reviewsToText((trustProfile?.reviews as Review[]) ?? [])}
      />
    </div>
  );
}
