import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { buildImportTemplateBuffer } from "@/lib/product-import";

export async function GET() {
  await requireAdmin();

  const buffer = await buildImportTemplateBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mau-import-san-pham.xlsx"',
    },
  });
}
