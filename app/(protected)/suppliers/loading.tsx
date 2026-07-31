export default function SuppliersLoading() {
  return (
    <div
      aria-label="Loading suppliers"
      className="animate-pulse space-y-4 rounded-3xl border border-slate-200 bg-white p-8"
      role="status"
    >
      <div className="h-8 w-48 rounded bg-slate-200" />
      <div className="h-12 rounded bg-slate-100" />
      <div className="h-20 rounded bg-slate-100" />
      <div className="h-20 rounded bg-slate-100" />
    </div>
  );
}
