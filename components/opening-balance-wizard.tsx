"use client";

import { useActionState, useState } from "react";

import {
  submitOpeningBalances,
  type OpeningBalanceState,
} from "@/app/(protected)/(admin)/opening-balances/actions";

type CustomerRow = {
  id: string;
  name: string;
  amountRon: string;
};

type SupplierRow = {
  id: string;
  name: string;
  currency: "RON" | "USD";
  originalAmount: string;
  purchaseExchangeRate: string;
};

const initialState: OpeningBalanceState = {};

function newId() {
  return globalThis.crypto.randomUUID();
}

function FieldErrors({
  errors,
}: Readonly<{ errors: readonly string[] | undefined }>) {
  if (!errors?.length) {
    return null;
  }

  return errors.map((error) => (
    <p className="mt-2 text-sm text-red-700" key={error}>
      {error}
    </p>
  ));
}

const moneyInputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

export function OpeningBalanceWizard({
  defaultOpeningDate,
}: Readonly<{ defaultOpeningDate: string }>) {
  const [state, formAction, pending] = useActionState(
    submitOpeningBalances,
    initialState,
  );
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);

  function addCustomer() {
    setCustomers((current) => [
      ...current,
      { id: newId(), name: "", amountRon: "" },
    ]);
  }

  function addSupplier() {
    setSuppliers((current) => [
      ...current,
      {
        id: newId(),
        name: "",
        currency: "RON",
        originalAmount: "",
        purchaseExchangeRate: "",
      },
    ]);
  }

  return (
    <form action={formAction} className="mt-8">
      <input
        name="customerReceivables"
        type="hidden"
        value={JSON.stringify(
          customers.map(({ name, amountRon }) => ({ name, amountRon })),
        )}
      />
      <input
        name="supplierPayables"
        type="hidden"
        value={JSON.stringify(
          suppliers.map(
            ({ name, currency, originalAmount, purchaseExchangeRate }) => ({
              name,
              currency,
              originalAmount,
              purchaseExchangeRate,
            }),
          ),
        )}
      />

      <ol
        aria-label="Opening balance setup progress"
        className="grid gap-2 sm:grid-cols-4"
      >
        {["Core balances", "Customers", "Suppliers", "Confirm"].map(
          (label, index) => {
            const number = index + 1;
            return (
              <li
                aria-current={number === step ? "step" : undefined}
                className={
                  number === step
                    ? "rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                    : "rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500"
                }
                key={label}
              >
                {number}. {label}
              </li>
            );
          },
        )}
      </ol>

      <fieldset className="mt-8 space-y-6" hidden={step !== 1}>
        <legend className="text-xl font-bold text-slate-950">
          Opening date and core values
        </legend>
        <p className="text-sm leading-6 text-slate-600">
          Enter historical values as of the opening date. Zero is allowed.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              className="text-sm font-semibold text-slate-800"
              htmlFor="opening-date"
            >
              Opening date
            </label>
            <input
              className={moneyInputClass}
              defaultValue={defaultOpeningDate}
              id="opening-date"
              max={defaultOpeningDate}
              name="openingDate"
              type="date"
            />
            <FieldErrors errors={state.errors?.openingDate} />
          </div>
          {[
            ["cashBalanceRon", "Cash balance", "cash-balance"],
            ["bankBalanceRon", "Bank balance", "bank-balance"],
            [
              "warehouseInventoryRon",
              "Warehouse inventory value",
              "warehouse-inventory",
            ],
            ["shopInventoryRon", "Shop inventory value", "shop-inventory"],
          ].map(([name, label, id]) => (
            <div key={name}>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor={id}
              >
                {label} (RON)
              </label>
              <input
                className={moneyInputClass}
                defaultValue="0.00"
                id={id}
                inputMode="decimal"
                name={name}
                type="text"
              />
              <FieldErrors
                errors={
                  state.errors?.[
                    name as
                      | "cashBalanceRon"
                      | "bankBalanceRon"
                      | "warehouseInventoryRon"
                      | "shopInventoryRon"
                  ]
                }
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
            onClick={() => setStep(2)}
            type="button"
          >
            Continue to customers
          </button>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-5" hidden={step !== 2}>
        <legend className="text-xl font-bold text-slate-950">
          Existing customer receivables
        </legend>
        <p className="text-sm leading-6 text-slate-600">
          Add each customer who currently owes the business. Leave this section
          empty if there are none.
        </p>
        {customers.map((customer, index) => (
          <div
            className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_12rem_auto]"
            key={customer.id}
          >
            <div>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor={`customer-name-${customer.id}`}
              >
                Customer {index + 1} name
              </label>
              <input
                className={moneyInputClass}
                id={`customer-name-${customer.id}`}
                onChange={(event) =>
                  setCustomers((current) =>
                    current.map((row) =>
                      row.id === customer.id
                        ? { ...row, name: event.target.value }
                        : row,
                    ),
                  )
                }
                value={customer.name}
              />
            </div>
            <div>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor={`customer-amount-${customer.id}`}
              >
                Amount (RON)
              </label>
              <input
                className={moneyInputClass}
                id={`customer-amount-${customer.id}`}
                inputMode="decimal"
                onChange={(event) =>
                  setCustomers((current) =>
                    current.map((row) =>
                      row.id === customer.id
                        ? { ...row, amountRon: event.target.value }
                        : row,
                    ),
                  )
                }
                type="text"
                value={customer.amountRon}
              />
            </div>
            <button
              className="self-end rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700"
              onClick={() =>
                setCustomers((current) =>
                  current.filter((row) => row.id !== customer.id),
                )
              }
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
        <FieldErrors errors={state.errors?.customerReceivables} />
        <button
          className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-800"
          onClick={addCustomer}
          type="button"
        >
          Add customer receivable
        </button>
        <div className="flex justify-between gap-3">
          <button
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800"
            onClick={() => setStep(1)}
            type="button"
          >
            Back
          </button>
          <button
            className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
            onClick={() => setStep(3)}
            type="button"
          >
            Continue to suppliers
          </button>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-5" hidden={step !== 3}>
        <legend className="text-xl font-bold text-slate-950">
          Existing supplier payables
        </legend>
        <p className="text-sm leading-6 text-slate-600">
          Add each supplier currently owed. USD payables require the historical
          exchange rate from the original purchase.
        </p>
        {suppliers.map((supplier, index) => (
          <div
            className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"
            key={supplier.id}
          >
            <div>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor={`supplier-name-${supplier.id}`}
              >
                Supplier {index + 1} name
              </label>
              <input
                className={moneyInputClass}
                id={`supplier-name-${supplier.id}`}
                onChange={(event) =>
                  setSuppliers((current) =>
                    current.map((row) =>
                      row.id === supplier.id
                        ? { ...row, name: event.target.value }
                        : row,
                    ),
                  )
                }
                value={supplier.name}
              />
            </div>
            <div>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor={`supplier-currency-${supplier.id}`}
              >
                Currency
              </label>
              <select
                className={moneyInputClass}
                id={`supplier-currency-${supplier.id}`}
                onChange={(event) =>
                  setSuppliers((current) =>
                    current.map((row) =>
                      row.id === supplier.id
                        ? {
                            ...row,
                            currency: event.target.value as "RON" | "USD",
                            purchaseExchangeRate:
                              event.target.value === "RON"
                                ? ""
                                : row.purchaseExchangeRate,
                          }
                        : row,
                    ),
                  )
                }
                value={supplier.currency}
              >
                <option value="RON">RON</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor={`supplier-amount-${supplier.id}`}
              >
                Original amount ({supplier.currency})
              </label>
              <input
                className={moneyInputClass}
                id={`supplier-amount-${supplier.id}`}
                inputMode="decimal"
                onChange={(event) =>
                  setSuppliers((current) =>
                    current.map((row) =>
                      row.id === supplier.id
                        ? { ...row, originalAmount: event.target.value }
                        : row,
                    ),
                  )
                }
                type="text"
                value={supplier.originalAmount}
              />
            </div>
            {supplier.currency === "USD" ? (
              <div>
                <label
                  className="text-sm font-semibold text-slate-800"
                  htmlFor={`supplier-rate-${supplier.id}`}
                >
                  Historical USD/RON rate
                </label>
                <input
                  className={moneyInputClass}
                  id={`supplier-rate-${supplier.id}`}
                  inputMode="decimal"
                  onChange={(event) =>
                    setSuppliers((current) =>
                      current.map((row) =>
                        row.id === supplier.id
                          ? {
                              ...row,
                              purchaseExchangeRate: event.target.value,
                            }
                          : row,
                      ),
                    )
                  }
                  type="text"
                  value={supplier.purchaseExchangeRate}
                />
              </div>
            ) : null}
            <button
              className="justify-self-start rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700"
              onClick={() =>
                setSuppliers((current) =>
                  current.filter((row) => row.id !== supplier.id),
                )
              }
              type="button"
            >
              Remove supplier
            </button>
          </div>
        ))}
        <FieldErrors errors={state.errors?.supplierPayables} />
        <button
          className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-800"
          onClick={addSupplier}
          type="button"
        >
          Add supplier payable
        </button>
        <div className="flex justify-between gap-3">
          <button
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800"
            onClick={() => setStep(2)}
            type="button"
          >
            Back
          </button>
          <button
            className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white"
            onClick={() => setStep(4)}
            type="button"
          >
            Review setup
          </button>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-5" hidden={step !== 4}>
        <legend className="text-xl font-bold text-slate-950">
          Confirm opening setup
        </legend>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          This operation is permanent. Completed opening records cannot be
          edited or deleted. Future corrections require an administrator
          reversal workflow.
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">Customer receivables</dt>
            <dd className="mt-1 text-xl font-bold text-slate-950">
              {customers.length}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">Supplier payables</dt>
            <dd className="mt-1 text-xl font-bold text-slate-950">
              {suppliers.length}
            </dd>
          </div>
        </dl>
        {state.message ? (
          <p
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {state.message}
          </p>
        ) : null}
        <div className="flex justify-between gap-3">
          <button
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800"
            onClick={() => setStep(3)}
            type="button"
          >
            Back
          </button>
          <button
            className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={pending}
            type="submit"
          >
            {pending
              ? "Creating opening records..."
              : "Create opening balances"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
