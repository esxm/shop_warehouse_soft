# Automatic business days

Business days remain an internal accounting boundary, but users never open,
close, or reopen them manually.

## Lifecycle

The `automatic-business-day-rollover` PostgreSQL cron job runs every minute.
For each business it compares the current instant with the business's IANA
timezone:

- the first run after local midnight closes the prior open day at the exact
  local midnight boundary;
- the prior day's last saved daily-sales draft is posted once;
- current credit sales are re-derived before close;
- the current date receives one open business day and one zero cash/bank daily
  sales draft; and
- a business-scoped advisory transaction lock makes repeated or concurrent
  rollover calls idempotent.

`ensure_current_business_day` runs the same locked logic when an authenticated
member loads an operational page. This is a fallback for the short interval
before the next cron run.

When automation is first enabled and today's date was already manually closed,
the recovery migration preserves and reverses that early closure, reopens the
same date, and records explicit automatic-reopen audits. It will then close
normally at local midnight.

The authenticated role no longer has execute permission on manual create,
close, reopen, or daily-sales close RPCs. `/business-days` redirects to
`/daily-sales`, and Business Days is removed from navigation.

## Operational transaction rule

Operational records continue to reference the internal `business_day_id`.
Employees always write against the automatically managed current open day.
The business date comes from that row, never from the browser clock.
