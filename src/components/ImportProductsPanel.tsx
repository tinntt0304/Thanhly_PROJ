"use client";

import { useState } from "react";
import Link from "next/link";
import {
  importProductsFromExcel,
  retryImportRow,
  type ImportRowResult,
} from "@/lib/actions/product-import";
import type { ImportRowInput } from "@/lib/product-import";

const inputClass =
  "rounded-md border border-neutral-300 bg-surface px-2 py-1 text-xs text-text focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500";

type Tab = "success" | "errors";

export function ImportProductsPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);
  const [tab, setTab] = useState<Tab>("errors");
  const [retryingRow, setRetryingRow] = useState<number | null>(null);

  const successResults = results?.filter((r) => r.success) ?? [];
  const errorResults = results?.filter((r) => !r.success) ?? [];

  async function handleImport() {
    if (!file) {
      setFormError("Vui lòng chọn file Excel.");
      return;
    }
    setFormError(null);
    setImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await importProductsFromExcel(fd);
      if ("error" in res) {
        setFormError(res.error);
        setResults(null);
      } else {
        setResults(res.results);
        setTab(res.errorCount > 0 ? "errors" : "success");
      }
    } finally {
      setImporting(false);
    }
  }

  function updateErrorField(row: number, key: keyof ImportRowInput, value: string) {
    setResults(
      (prev) => prev?.map((r) => (r.row === row ? { ...r, input: { ...r.input, [key]: value } } : r)) ?? prev
    );
  }

  async function handleRetry(row: number) {
    const target = results?.find((r) => r.row === row);
    if (!target) return;
    setRetryingRow(row);
    try {
      const updated = await retryImportRow(row, target.input);
      setResults((prev) => prev?.map((r) => (r.row === row ? updated : r)) ?? prev);
    } finally {
      setRetryingRow(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-lg font-bold text-text">Import sản phẩm từ Excel</h1>
            <p className="text-sm text-neutral-600">
              Tải file mẫu, điền thông tin theo từng dòng (giống các trường ở trang đăng sản
              phẩm) rồi tải lên để đăng hàng loạt.
            </p>
          </div>
          <a
            href="/api/admin/products/import-template"
            className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            ⬇ Tải file mẫu
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            {importing ? "Đang import..." : "Import"}
          </button>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </div>

      {results && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-md bg-neutral-100 px-3 py-1.5 text-neutral-700">
              Tổng: <strong>{results.length}</strong>
            </span>
            <span className="rounded-md bg-accent-2-100 px-3 py-1.5 text-accent-2-700">
              Thành công: <strong>{successResults.length}</strong>
            </span>
            <span className="rounded-md bg-red-50 px-3 py-1.5 text-red-700">
              Lỗi: <strong>{errorResults.length}</strong>
            </span>
          </div>

          <div className="flex gap-2 border-b border-neutral-200 text-sm">
            <button
              type="button"
              onClick={() => setTab("success")}
              className={`px-3 py-2 ${
                tab === "success" ? "border-b-2 border-accent-500 font-medium text-text" : "text-neutral-500"
              }`}
            >
              Thành công ({successResults.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("errors")}
              className={`px-3 py-2 ${
                tab === "errors" ? "border-b-2 border-accent-500 font-medium text-text" : "text-neutral-500"
              }`}
            >
              Lỗi ({errorResults.length})
            </button>
          </div>

          {tab === "success" &&
            (successResults.length === 0 ? (
              <p className="text-sm text-neutral-500">Chưa có sản phẩm nào thành công.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {successResults.map((r) => (
                  <li key={r.row} className="flex items-center gap-2">
                    <span className="text-neutral-500">Dòng {r.row}:</span>
                    <Link href={`/admin/products/${r.productId}`} className="text-accent-600 underline">
                      {r.productTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}

          {tab === "errors" &&
            (errorResults.length === 0 ? (
              <p className="text-sm text-neutral-500">Không có dòng nào bị lỗi.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {errorResults.map((r) => (
                  <div
                    key={r.row}
                    className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50/40 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-red-700">
                        Dòng {r.row}: {r.error}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRetry(r.row)}
                        disabled={retryingRow === r.row}
                        className="rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
                      >
                        {retryingRow === r.row ? "Đang lưu..." : "Thử lại"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <Field
                        label="Tên sản phẩm"
                        value={r.input.title}
                        onChange={(v) => updateErrorField(r.row, "title", v)}
                      />
                      <Field
                        label="Tình trạng"
                        value={r.input.condition}
                        onChange={(v) => updateErrorField(r.row, "condition", v)}
                      />
                      <Field
                        label="Số lượng"
                        value={r.input.quantity}
                        onChange={(v) => updateErrorField(r.row, "quantity", v)}
                      />
                      <Field
                        label="Giá khởi điểm"
                        value={r.input.startPrice}
                        onChange={(v) => updateErrorField(r.row, "startPrice", v)}
                      />
                      <Field
                        label="Bước giá tối thiểu"
                        value={r.input.minBidStep}
                        onChange={(v) => updateErrorField(r.row, "minBidStep", v)}
                      />
                      <Field
                        label="Giá mua ngay"
                        value={r.input.buyNowPrice}
                        onChange={(v) => updateErrorField(r.row, "buyNowPrice", v)}
                      />
                      <Field
                        label="Thời gian kết thúc"
                        value={r.input.endTime}
                        onChange={(v) => updateErrorField(r.row, "endTime", v)}
                        placeholder="yyyy-mm-dd hh:mm"
                      />
                      <Field
                        label="Ảnh (URL, cách nhau dấu phẩy)"
                        value={r.input.images}
                        onChange={(v) => updateErrorField(r.row, "images", v)}
                        className="sm:col-span-2 lg:col-span-3"
                      />
                      <Field
                        label="Mô tả"
                        value={r.input.description}
                        onChange={(v) => updateErrorField(r.row, "description", v)}
                        textarea
                        className="sm:col-span-2 lg:col-span-3"
                      />
                      <Field
                        label="Thuộc tính"
                        value={r.input.attributesText}
                        onChange={(v) => updateErrorField(r.row, "attributesText", v)}
                        className="sm:col-span-2 lg:col-span-3"
                      />
                      <Field
                        label="Nhãn"
                        value={r.input.tagsText}
                        onChange={(v) => updateErrorField(r.row, "tagsText", v)}
                        className="sm:col-span-2 lg:col-span-3"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={inputClass} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
      )}
    </label>
  );
}
