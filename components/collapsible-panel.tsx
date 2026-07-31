"use client";

import { useEffect, useState, type ReactNode } from "react";

export function CollapsiblePanel({
  title,
  description,
  children,
  defaultOpen = false,
  id,
}: Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  id?: string;
}>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!id) {
      return;
    }

    function openWhenHashMatches() {
      if (window.location.hash.slice(1) === id) {
        setIsOpen(true);
      }
    }

    openWhenHashMatches();
    window.addEventListener("hashchange", openWhenHashMatches);

    return () => window.removeEventListener("hashchange", openWhenHashMatches);
  }, [id]);

  return (
    <details
      className="group rounded-3xl border border-slate-200 bg-white shadow-sm"
      id={id}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-6">
        <span className="min-w-0">
          <span className="block text-lg font-bold text-slate-950 sm:text-xl">
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-sm leading-5 text-slate-600">
              {description}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-2xl text-teal-700 transition group-open:rotate-180"
        >
          ↓
        </span>
      </summary>
      <div className="border-t border-slate-200 p-4 sm:p-6">{children}</div>
    </details>
  );
}
