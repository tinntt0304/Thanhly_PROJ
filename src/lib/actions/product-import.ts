"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { parseImportFile, validateImportRow, type ImportRowInput } from "@/lib/product-import";

export type ImportRowResult = {
  row: number;
  input: ImportRowInput;
  success: boolean;
  productId?: string;
  productTitle?: string;
  error?: string;
};

export type ImportSummary = {
  total: number;
  successCount: number;
  errorCount: number;
  results: ImportRowResult[];
};

async function createFromRow(row: number, input: ImportRowInput): Promise<ImportRowResult> {
  const validated = validateImportRow(input);
  if (!validated.ok) {
    return { row, input, success: false, error: validated.error };
  }

  const product = await prisma.product.create({ data: validated.data });
  return { row, input, success: true, productId: product.id, productTitle: product.title };
}

export async function importProductsFromExcel(
  formData: FormData
): Promise<ImportSummary | { error: string }> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Vui lòng chọn file Excel để import." };
  }

  let rows: ImportRowInput[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    rows = await parseImportFile(buffer);
  } catch {
    return { error: "Không đọc được file. Hãy dùng đúng file mẫu .xlsx." };
  }

  if (rows.length === 0) {
    return { error: "File không có dữ liệu sản phẩm nào." };
  }

  const results: ImportRowResult[] = [];
  // Chạy tuần tự (không Promise.all) để tránh dồn dập hàng trăm insert cùng lúc vào DB.
  for (let i = 0; i < rows.length; i++) {
    results.push(await createFromRow(i + 2, rows[i])); // +2: dòng 1 là header
  }

  const successCount = results.filter((r) => r.success).length;
  if (successCount > 0) {
    revalidatePath("/");
    revalidatePath("/admin");
  }

  return {
    total: results.length,
    successCount,
    errorCount: results.length - successCount,
    results,
  };
}

export async function retryImportRow(row: number, input: ImportRowInput): Promise<ImportRowResult> {
  await requireAdmin();

  const result = await createFromRow(row, input);
  if (result.success) {
    revalidatePath("/");
    revalidatePath("/admin");
  }
  return result;
}
