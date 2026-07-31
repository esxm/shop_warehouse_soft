import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import {
  cashBankReportFilterSchema,
  createCashBankReportCsv,
} from "@/lib/reports/cash-bank";
import { getCashBankReportPageData } from "@/services/cash-bank-report";

export async function GET(request: Request) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const searchParams = new URL(request.url).searchParams;
  const filterResult = cashBankReportFilterSchema.safeParse({
    accountId: searchParams.get("accountId") ?? undefined,
    fromDate: searchParams.get("fromDate") ?? undefined,
    toDate: searchParams.get("toDate") ?? undefined,
    entryType: searchParams.get("entryType") ?? undefined,
  });

  if (!filterResult.success) {
    return new Response(
      filterResult.error.issues[0]?.message ??
        "Check the cash and bank export filters.",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  const { report } = await getCashBankReportPageData(
    context,
    filterResult.data,
  );
  const csv = createCashBankReportCsv(report, filterResult.data);

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="cash-and-bank-report.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
