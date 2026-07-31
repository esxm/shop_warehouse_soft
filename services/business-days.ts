import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";

export type BusinessDay = Readonly<{
  id: string;
  businessId: string;
  businessDate: string;
  status: "open" | "closed";
  openedAt: string;
  openedBy: string;
  closedAt: string | null;
  closedBy: string | null;
  reopenReason: string | null;
}>;

function mapBusinessDay(row: {
  id: string;
  business_id: string;
  business_date: string;
  status: "open" | "closed";
  opened_at: string;
  opened_by: string;
  closed_at: string | null;
  closed_by: string | null;
  reopen_reason: string | null;
}): BusinessDay {
  return {
    id: row.id,
    businessId: row.business_id,
    businessDate: row.business_date,
    status: row.status,
    openedAt: row.opened_at,
    openedBy: row.opened_by,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    reopenReason: row.reopen_reason,
  };
}

export async function getBusinessDays(
  context: CurrentUserContext,
  limit = 30,
): Promise<readonly BusinessDay[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("business_days")
    .select(
      "id, business_id, business_date, status, opened_at, opened_by, closed_at, closed_by, reopen_reason",
    )
    .eq("business_id", context.business.id)
    .order("business_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Unable to load business days.");
  }

  return data.map(mapBusinessDay);
}

export async function getOpenBusinessDay(
  businessId: string,
): Promise<BusinessDay | null> {
  const supabase = await createServerSupabaseClient();
  const { data: ensuredDayId, error: ensureError } = await supabase.rpc(
    "ensure_current_business_day",
    {
      target_business_id: businessId,
    },
  );

  if (ensureError || !ensuredDayId) {
    throw new Error("Unable to initialize the automatic business day.");
  }

  const { data, error } = await supabase
    .from("business_days")
    .select(
      "id, business_id, business_date, status, opened_at, opened_by, closed_at, closed_by, reopen_reason",
    )
    .eq("business_id", businessId)
    .eq("id", ensuredDayId)
    .eq("status", "open")
    .single();

  if (error) {
    throw new Error("Unable to load the open business day.");
  }

  return mapBusinessDay(data);
}
