export default function ExpensesLoading() {
  return (
    <div className="space-y-6" aria-label="Loading expenses">
      <div className="h-44 animate-pulse rounded-3xl bg-slate-200" />
      <div className="h-96 animate-pulse rounded-3xl bg-slate-200" />
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
    </div>
  );
}
