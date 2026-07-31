import type { ReactNode } from "react";

export function HistoryPeriodFilter({
  action,
  fromDate,
  toDate,
  error,
  anchor = "history",
  children,
}: Readonly<{
  action: string;
  fromDate: string;
  toDate: string;
  error?: string | null;
  anchor?: string;
  children?: ReactNode;
}>) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <form
        action={`${action}#${anchor}`}
        className="flex flex-wrap items-end gap-3"
        method="get"
      >
        <label className="text-sm font-semibold text-slate-800">
          History from
          <input
            className="mt-2 block rounded-xl border border-slate-300 px-4 py-2.5"
            defaultValue={fromDate}
            name="history_from"
            required
            type="date"
          />
        </label>
        <label className="text-sm font-semibold text-slate-800">
          History to
          <input
            className="mt-2 block rounded-xl border border-slate-300 px-4 py-2.5"
            defaultValue={toDate}
            name="history_to"
            required
            type="date"
          />
        </label>
        {children}
        <button
          className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
          type="submit"
        >
          Show period
        </button>
      </form>
      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error} Showing today instead.
        </p>
      ) : null}
    </div>
  );
}
