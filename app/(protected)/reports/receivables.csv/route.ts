import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import {
  createCustomerReceivablesCsv,
  customerReceivablesFilterSchema,
} from "@/lib/reports/customer-receivables";
import { getCustomerReceivablesPageData } from "@/services/customer-receivables-report";

export async function GET(request: Request) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const searchParams = new URL(request.url).searchParams;
  const filterResult = customerReceivablesFilterSchema.safeParse({
    customerId: searchParams.get("customerId") ?? undefined,
    outstandingOnly: searchParams.get("outstandingOnly") ?? undefined,
    overdueOnly: searchParams.get("overdueOnly") ?? undefined,
    fromDate: searchParams.get("fromDate") ?? undefined,
    toDate: searchParams.get("toDate") ?? undefined,
  });

  if (!filterResult.success) {
    return new Response(
      filterResult.error.issues[0]?.message ??
        "Check the receivables export filters.",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  const asOfDate = getTodayInBusinessTimeZone(context.business.timezone);
  const { report } = await getCustomerReceivablesPageData(
    context,
    filterResult.data,
    asOfDate,
  );
  const csv = createCustomerReceivablesCsv(report, filterResult.data, asOfDate);

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="customer-receivables-${asOfDate}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
