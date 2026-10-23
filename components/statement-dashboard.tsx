"use client";

import type { ClassifiedTransaction } from "../lib/statement-analysis";
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, ReactNode } from "react";

type Summary = {
  balanceSheet: { assets: number; liabilities: number };
  incomeAndExpenditure: { income: number; expenditure: number; net: number };
  byCategory: Record<string, number>;
};

type Analysis = {
  fileName: string;
  transactionCount: number;
  summary: Summary;
  transactions: ClassifiedTransaction[];
};

type Filter = "all" | "income" | "expense" | "asset" | "liability";

const MAX_UPLOAD_BYTES = 1_000_000;

function formatAmount(value: number) {
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "logo"
    | "overview"
    | "file"
    | "upload"
    | "arrow"
    | "check"
    | "spark"
    | "close"
    | "download";
  className?: string;
}) {
  const paths: Record<string, ReactNode> = {
    logo: (
      <>
        <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
        <path d="m8 12 2.5 2.5L16.5 8" />
      </>
    ),
    overview: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m0 0L7 9m5-5 5 5" />
        <path d="M20 16.5v3A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-3" />
      </>
    ),
    arrow: <path d="M7 10l5 5 5-5" />,
    check: <path d="m5 12 4 4L19 6" />,
    spark: (
      <>
        <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
        <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    download: (
      <>
        <path d="M12 3v12m0 0 5-5m-5 5-5-5" />
        <path d="M5 17v3h14v-3" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function csvTextCell(value: string) {
  const safe = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function StatementDashboard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  async function analyzeFile(file: File) {
    setError("");
    setSelectedFile(file.name);

    if (file.size === 0) {
      setError("That file is empty. Choose a statement with transaction rows.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("The file is larger than 1 MB. Upload a smaller CSV statement.");
      return;
    }

    setLoading(true);
    setAnalysis(null);
    setFilter("all");

    try {
      const form = new FormData();
      form.append("statement", file);
      const response = await fetch("/api/statement-analysis", {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      const result = (await response.json()) as Analysis & { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "We couldn't read this statement.");
      }
      setAnalysis(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong while analyzing the statement.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void analyzeFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void analyzeFile(file);
  }

  function reset() {
    setAnalysis(null);
    setSelectedFile("");
    setError("");
    setFilter("all");
  }

  async function loadSample() {
    const csv = [
      "date,description,amount",
      "2026-10-01,Client payment,2450.00",
      "2026-10-02,Office rent,-750.00",
      "2026-10-03,Electricity bill,-80.50",
      "2026-10-04,Supermarket,-42.20",
      "2026-10-05,ATM cash withdrawal,-100.00",
    ].join("\n");
    const sample = new File([csv], "sample-statement.csv", {
      type: "text/csv",
    });
    await analyzeFile(sample);
  }

  function downloadCsv() {
    if (!analysis) return;
    const rows = [
      ["Date", "Description", "Amount", "Category", "Section"],
      ...analysis.transactions.map((item) => [
        csvTextCell(item.date),
        csvTextCell(item.description),
        item.amount.toFixed(2),
        csvTextCell(item.category),
        csvTextCell(item.statementSection),
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "statement-analysis.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const visibleTransactions =
    analysis?.transactions.filter((item) => {
      if (filter === "all") return true;
      return item.bucket === filter;
    }) ?? [];

  const categoryRows = analysis
    ? Object.entries(analysis.summary.byCategory)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 5)
    : [];
  const categoryMax = Math.max(
    1,
    ...categoryRows.map(([, amount]) => Math.abs(amount)),
  );

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "income", label: "Income" },
    { key: "expense", label: "Expenses" },
    { key: "asset", label: "Assets" },
    { key: "liability", label: "Liabilities" },
  ];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/75 px-5 py-6 lg:flex">
        <a href="#overview" className="mb-12 flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm shadow-emerald-900/15">
            <Icon name="logo" className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight text-slate-900">
              Ledgerly
            </span>
            <span className="block text-xs text-slate-500">
              Statement workspace
            </span>
          </span>
        </a>

        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Workspace
        </div>
        <a
          href="#overview"
          className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800"
        >
          <Icon name="overview" className="h-4 w-4" />
          Overview
        </a>
        <a
          href="#transactions"
          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Icon name="file" className="h-4 w-4" />
          Transactions
        </a>

        <div className="mt-auto rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-emerald-700">
            <Icon name="check" className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Private by design
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Statements are processed for this report and are not saved by the
            app.
          </p>
        </div>
      </aside>

      <main id="overview" className="min-w-0 flex-1">
        <header className="flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/70 px-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <Icon name="logo" className="h-5 w-5" />
            </span>
            <span className="font-bold tracking-tight">Ledgerly</span>
          </div>
          <div className="hidden text-sm text-slate-500 lg:block">
            Your financial snapshot, ready to review
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Local analysis
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                <Icon name="spark" className="h-4 w-4" />
                Statement review
              </div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Make sense of every transaction.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Upload a CSV statement to see suggested categories, cash flow,
                and a review-ready transaction list.
              </p>
            </div>
            {analysis ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Icon name="upload" className="h-4 w-4" />
                New statement
              </button>
            ) : null}
          </section>

          {!analysis ? (
            <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_12px_40px_-28px_rgba(15,23,42,0.28)] sm:p-6">
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={
                  "rounded-2xl border-2 border-dashed px-5 py-10 text-center transition sm:px-10 sm:py-14 " +
                  (dragging
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 bg-slate-50/80 hover:border-emerald-300")
                }
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileChange}
                  className="sr-only"
                  aria-label="Choose a CSV bank statement"
                />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200">
                  <Icon name="upload" className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-lg font-semibold text-slate-900">
                  Drop your statement here
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  CSV or plain text · up to 1 MB
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={loading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Icon name="file" className="h-4 w-4" />
                    )}
                    {loading ? "Analyzing statement…" : "Choose a statement"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadSample()}
                    disabled={loading}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Try sample data
                  </button>
                </div>
                <p className="mt-5 text-xs text-slate-400">
                  Your file is sent to this app for processing and is not
                  stored.
                </p>
              </div>
              {selectedFile && loading ? (
                <p className="mt-4 text-center text-sm text-slate-500">
                  Reading {selectedFile}…
                </p>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                  {error}
                </p>
              ) : null}
            </section>
          ) : (
            <>
              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <Icon name="file" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {analysis.fileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {analysis.transactionCount.toLocaleString()} transactions
                      · suggested categories
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Icon name="download" className="h-4 w-4" />
                  Export CSV
                </button>
              </div>

              <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Income",
                    value: analysis.summary.incomeAndExpenditure.income,
                    tone: "text-emerald-700",
                    mark: "+",
                  },
                  {
                    label: "Expenses",
                    value: analysis.summary.incomeAndExpenditure.expenditure,
                    tone: "text-rose-600",
                    mark: "−",
                  },
                  {
                    label: "Net cash flow",
                    value: analysis.summary.incomeAndExpenditure.net,
                    tone:
                      analysis.summary.incomeAndExpenditure.net >= 0
                        ? "text-emerald-700"
                        : "text-rose-600",
                    mark: "",
                  },
                ].map((metric) => (
                  <article
                    key={metric.label}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
                  >
                    <p className="text-sm font-medium text-slate-500">
                      {metric.label}
                    </p>
                    <p
                      className={
                        "mt-3 text-2xl font-semibold tracking-tight " +
                        metric.tone
                      }
                    >
                      {metric.mark}
                      {formatAmount(Math.abs(metric.value))}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      In statement currency
                    </p>
                  </article>
                ))}
                <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Transactions
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                    {analysis.transactionCount.toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">Ready to review</p>
                </article>
              </section>

              <section className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.6fr]">
                <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Category breakdown
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Suggested from transaction descriptions
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                      {categoryRows.length} categories
                    </span>
                  </div>
                  <div className="mt-6 space-y-5">
                    {categoryRows.length ? (
                      categoryRows.map(([category, amount]) => (
                        <div key={category}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                            <span className="truncate font-medium text-slate-700">
                              {category}
                            </span>
                            <span className="shrink-0 tabular-nums text-slate-500">
                              {formatAmount(Math.abs(amount))}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{
                                width:
                                  Math.max(
                                    6,
                                    (Math.abs(amount) / categoryMax) * 100,
                                  ) + "%",
                              }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        No category totals were returned.
                      </p>
                    )}
                  </div>
                  <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-400">
                    Transfers and balance-sheet movements are shown separately
                    from income and expenses.
                  </p>
                </article>

                <article
                  id="transactions"
                  className="min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        Transactions
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Review suggested classifications before using them.
                      </p>
                    </div>
                    <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
                      {filters.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setFilter(item.key)}
                          className={
                            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition " +
                            (filter === item.key
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-800")
                          }
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                          <th className="px-6 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">
                            Description
                          </th>
                          <th className="px-4 py-3 font-semibold">Category</th>
                          <th className="px-4 py-3 text-right font-semibold">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTransactions.map((item, index) => (
                          <tr
                            key={item.date + item.description + index}
                            className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                          >
                            <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                              {item.date}
                            </td>
                            <td className="max-w-[240px] truncate px-4 py-4 font-medium text-slate-800">
                              {item.description}
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                                {item.category}
                              </span>
                            </td>
                            <td
                              className={
                                "whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums " +
                                (item.amount < 0
                                  ? "text-rose-600"
                                  : "text-slate-800")
                              }
                            >
                              {item.amount < 0 ? "−" : "+"}
                              {formatAmount(Math.abs(item.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visibleTransactions.length ? (
                      <p className="p-8 text-center text-sm text-slate-500">
                        No transactions match this filter.
                      </p>
                    ) : null}
                  </div>
                  <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 sm:px-6">
                    Amounts are shown in the currency used by the uploaded
                    statement.
                  </div>
                </article>
              </section>
            </>
          )}

          <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200/70 py-5 text-xs text-slate-400 sm:flex-row">
            <span>Ledgerly · Statement analysis</span>
            <span>
              Categories are suggestions. Review before posting to your
              accounts.
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
