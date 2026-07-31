"use client";

export type ReversalFormState = Readonly<{
  message?: string;
  errors?: Readonly<{
    reason?: readonly string[];
    confirmation?: readonly string[];
  }>;
}>;

export type ReversalHiddenField = Readonly<{
  name: string;
  value: string;
}>;

export function ReversalForm({
  action,
  state,
  pending,
  id,
  reasonLabel,
  confirmationLabel,
  submitLabel,
  hiddenFields,
}: Readonly<{
  action: (formData: FormData) => void;
  state: ReversalFormState;
  pending: boolean;
  id: string;
  reasonLabel: string;
  confirmationLabel: string;
  submitLabel: string;
  hiddenFields: readonly ReversalHiddenField[];
}>) {
  return (
    <form action={action} className="mt-4 rounded-xl bg-red-50 p-4">
      {hiddenFields.map((field) => (
        <input
          key={field.name}
          name={field.name}
          type="hidden"
          value={field.value}
        />
      ))}
      <label className="text-sm font-semibold text-red-950" htmlFor={id}>
        {reasonLabel}
      </label>
      <textarea
        className="mt-2 min-h-24 w-full rounded-xl border border-red-300 bg-white px-3 py-3 text-slate-950"
        id={id}
        maxLength={500}
        minLength={10}
        name="reason"
        required
      />
      {state.errors?.reason?.map((error) => (
        <p className="mt-2 text-sm text-red-800" key={error}>
          {error}
        </p>
      ))}
      <label className="mt-3 flex min-h-11 items-start gap-3 text-sm text-red-950">
        <input
          className="mt-1 size-5 shrink-0"
          name="confirmation"
          required
          type="checkbox"
          value="confirm"
        />
        {confirmationLabel}
      </label>
      {state.errors?.confirmation?.map((error) => (
        <p className="mt-2 text-sm text-red-800" key={error}>
          {error}
        </p>
      ))}
      {state.message ? (
        <p className="mt-3 text-sm font-medium text-red-800" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="mt-3 w-full rounded-xl bg-red-800 px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Reversing…" : submitLabel}
      </button>
    </form>
  );
}
