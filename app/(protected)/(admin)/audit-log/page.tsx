import Link from "next/link";

import { requireAdmin } from "@/lib/auth/session";
import {
  formatInstantInBusinessTimeZone,
  getTodayInBusinessTimeZone,
} from "@/lib/date/business-date";
import {
  auditLogFilterSchema,
  formatAuditData,
  type AuditLogFilter,
} from "@/lib/audit/audit-log";
import { getAuditLogPageData } from "@/services/audit-log";

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll(".", " · ");
}

export default async function AuditLogPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireAdmin();
  const query = await searchParams;
  const requestedFromDate = firstQueryValue(query.fromDate);
  const requestedToDate = firstQueryValue(query.toDate);
  const defaultHistoryDate = getTodayInBusinessTimeZone(
    context.business.timezone,
  );
  const useDefaultHistoryDate = !requestedFromDate && !requestedToDate;
  const filterResult = auditLogFilterSchema.safeParse({
    userId: firstQueryValue(query.userId),
    action: firstQueryValue(query.action),
    entityType: firstQueryValue(query.entityType),
    fromDate: useDefaultHistoryDate ? defaultHistoryDate : requestedFromDate,
    toDate: useDefaultHistoryDate ? defaultHistoryDate : requestedToDate,
  });
  const defaultFilter = auditLogFilterSchema.parse({});
  const filter: AuditLogFilter = filterResult.success
    ? filterResult.data
    : defaultFilter;
  const data = await getAuditLogPageData(context, filter);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
          Administrator only
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Audit log
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Immutable business changes, corrections, responsible users, reasons,
          and safely rendered before/after data.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Filters</h2>
            <p className="mt-2 text-sm text-slate-600">
              Dates use the {context.business.timezone} business calendar.
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-teal-700 hover:text-teal-900"
            href="/audit-log"
          >
            Clear filters
          </Link>
        </div>
        <form
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]"
          method="get"
        >
          <label className="text-sm font-semibold text-slate-800">
            User
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              defaultValue={filter.userId ?? ""}
              name="userId"
            >
              <option value="">All users</option>
              {data.users.map((user) => (
                <option key={user.value} value={user.value}>
                  {user.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Action
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.action ?? ""}
              list="audit-actions"
              name="action"
              placeholder="All actions"
            />
            <datalist id="audit-actions">
              {data.actions.map((action) => (
                <option key={action} value={action} />
              ))}
            </datalist>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Entity type
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.entityType ?? ""}
              list="audit-entity-types"
              name="entityType"
              placeholder="All entity types"
            />
            <datalist id="audit-entity-types">
              {data.entityTypes.map((entityType) => (
                <option key={entityType} value={entityType} />
              ))}
            </datalist>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            From date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.fromDate ?? ""}
              name="fromDate"
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            To date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.toDate ?? ""}
              name="toDate"
              type="date"
            />
          </label>
          <button
            className="self-end rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
            type="submit"
          >
            Apply
          </button>
        </form>
        {!filterResult.success ? (
          <p
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {filterResult.error.issues[0]?.message ??
              "Check the audit-log filters."}{" "}
            Showing the latest unfiltered events.
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-950">Events</h2>
          <p className="text-sm text-slate-500">
            {data.totalCount} matching event
            {data.totalCount === 1 ? "" : "s"}
            {data.isTruncated ? " · showing latest 200" : ""}
          </p>
        </div>

        {data.entries.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No audit events match these filters.
          </p>
        ) : (
          <ol className="mt-5 max-h-[38rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
            {data.entries.map((entry) => (
              <li
                className="rounded-2xl border border-slate-200 p-5"
                id={`audit-event-${entry.id}`}
                key={entry.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-bold capitalize text-slate-950">
                      {humanize(entry.action)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {entry.actorName} · {entry.businessDate}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatInstantInBusinessTimeZone(
                        entry.createdAt,
                        context.business.timezone,
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {humanize(entry.entityType)}
                    </span>
                    {entry.entityHref ? (
                      <Link
                        className="mt-3 block text-sm font-semibold text-teal-700 hover:text-teal-900"
                        href={entry.entityHref}
                      >
                        Open affected record
                      </Link>
                    ) : null}
                  </div>
                </div>

                {entry.reason ? (
                  <div className="mt-4 rounded-xl bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Administrative reason
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-950">
                      {entry.reason}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <details className="rounded-xl bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                      Before
                    </summary>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                      {formatAuditData(entry.previousData)}
                    </pre>
                  </details>
                  <details className="rounded-xl bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                      After
                    </summary>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                      {formatAuditData(entry.newData)}
                    </pre>
                  </details>
                </div>
                <p className="mt-3 break-all text-xs text-slate-400">
                  Event {entry.id}
                  {entry.entityId ? ` · Record ${entry.entityId}` : ""}
                  {` · User ${entry.actorUserId}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
