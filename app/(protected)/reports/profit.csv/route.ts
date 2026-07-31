import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { createProfitCsv } from "@/lib/reports/profit";
import { resolveRevenueQuery } from "@/lib/reports/revenue";
import { getProfitReport } from "@/services/profit-report";

export async function GET(request: Request) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const searchParams = new URL(request.url).searchParams;
  const resolved = resolveRevenueQuery(
    {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      preset: searchParams.get("preset") ?? undefined,
    },
    getTodayInBusinessTimeZone(context.business.timezone),
  );

  if (resolved.error) {
    return new Response(resolved.error, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const report = await getProfitReport(context, resolved.range);
  const csv = createProfitCsv(report, resolved.range);

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="product-profit.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
