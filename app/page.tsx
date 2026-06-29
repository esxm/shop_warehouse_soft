import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Project foundation
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Shop and warehouse management
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
          The application shell is ready. Financial and inventory features will
          be added incrementally after their data and security foundations are
          in place.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Base currency", "RON"],
            ["Inventory scope", "Value tracking"],
            ["Phase", "Foundation"],
          ].map(([label, value]) => (
            <div
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              key={label}
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
