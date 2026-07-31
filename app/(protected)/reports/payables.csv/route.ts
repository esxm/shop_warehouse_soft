import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import {
  createSupplierPayablesCsv,
  supplierPayablesFilterSchema,
} from "@/lib/reports/supplier-payables";
import { getSupplierPayablesPageData } from "@/services/supplier-payables-report";

export async function GET(request: Request) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const searchParams = new URL(request.url).searchParams;
  const filterResult = supplierPayablesFilterSchema.safeParse({
    supplierId: searchParams.get("supplierId") ?? undefined,
    currency: searchParams.get("currency") ?? undefined,
    outstandingOnly: searchParams.get("outstandingOnly") ?? undefined,
    dueFromDate: searchParams.get("dueFromDate") ?? undefined,
    dueToDate: searchParams.get("dueToDate") ?? undefined,
  });

  if (!filterResult.success) {
    return new Response(
      filterResult.error.issues[0]?.message ??
        "Check the payables export filters.",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  const asOfDate = getTodayInBusinessTimeZone(context.business.timezone);
  const { report, currentUsdRonRate } = await getSupplierPayablesPageData(
    context,
    filterResult.data,
    asOfDate,
  );
  const csv = createSupplierPayablesCsv(
    report,
    filterResult.data,
    currentUsdRonRate,
  );

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="supplier-payables-${asOfDate}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
