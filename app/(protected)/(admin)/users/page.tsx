import { EmployeeAccessForm } from "@/components/employee-access-form";
import { InviteEmployeeForm } from "@/components/invite-employee-form";
import { requireAdmin } from "@/lib/auth/session";
import { listBusinessUsers } from "@/services/user-management";

export default async function UsersPage() {
  const context = await requireAdmin();
  const users = await listBusinessUsers(context);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
        Administrator
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        Users
      </h1>
      <p className="mt-3 text-slate-600">
        Manage access to {context.business.name}. New accounts always start as
        employees.
      </p>

      <div className="mt-8">
        <InviteEmployeeForm />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-xl border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 text-sm text-slate-500">
              <th className="px-3 py-3 font-semibold">Name</th>
              <th className="px-3 py-3 font-semibold">Email</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Access</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-b border-slate-100" key={user.id}>
                <td className="px-3 py-4 font-medium text-slate-950">
                  {user.fullName ?? "Not provided"}
                </td>
                <td className="px-3 py-4 text-slate-600">{user.email}</td>
                <td className="px-3 py-4 capitalize text-slate-600">
                  {user.role}
                </td>
                <td className="px-3 py-4 text-slate-600">
                  {user.isActive ? "Active" : "Inactive"}
                </td>
                <td className="px-3 py-4">
                  {user.role === "employee" ? (
                    <EmployeeAccessForm
                      active={user.isActive}
                      userId={user.id}
                    />
                  ) : (
                    <span className="text-xs text-slate-500">
                      Administrator
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
