export function PlaceholderPage({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
        Step 3
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-slate-600">{description}</p>
    </section>
  );
}
