export function HistoryDateFilter({
  action,
  date,
  error,
  anchor = "history",
}: Readonly<{
  action: string;
  date: string;
  error?: string | null;
  anchor?: string;
}>) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <form
        action={`${action}#${anchor}`}
        className="flex flex-wrap items-end gap-3"
        method="get"
      >
        <label className="text-sm font-semibold text-slate-800">
          History date
          <input
            className="mt-2 block rounded-xl border border-slate-300 px-4 py-2.5"
            defaultValue={date}
            name="history_date"
            required
            type="date"
          />
        </label>
        <button
          className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
          type="submit"
        >
          Show date
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
