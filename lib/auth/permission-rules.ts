import type { CurrentUserContext } from "@/lib/auth/types";

export type BusinessDayAccessRecord = Readonly<{
  id: string;
  businessId: string;
  status: string;
}>;

export class OpenBusinessDayRequiredError extends Error {
  constructor() {
    super("An open business day is required.");
    this.name = "OpenBusinessDayRequiredError";
  }
}

export function assertOpenBusinessDayAccess<
  TBusinessDay extends BusinessDayAccessRecord,
>(context: CurrentUserContext, businessDay: TBusinessDay | null): TBusinessDay {
  if (
    !businessDay ||
    businessDay.businessId !== context.business.id ||
    businessDay.status !== "open"
  ) {
    throw new OpenBusinessDayRequiredError();
  }

  return businessDay;
}
