export default function CashAndBankLoading() {
  return (
    <div
      aria-label="Loading cash and bank ledger"
      className="space-y-6"
      role="status"
    >
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />
      <div className="h-80 animate-pulse rounded-3xl bg-slate-200" />
    </div>
  );
}
