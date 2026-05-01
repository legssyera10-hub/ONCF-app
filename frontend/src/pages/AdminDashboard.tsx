import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { AdminMailRoutingSettings, AdminUser, Establishment, Role } from "../types";
import { formatDateTime } from "../utils/format";

const roleOptions: Role[] = ["ADMIN", "PERMANENT", "ETABLISSEMENT", "SUIVI"];

type AdminPrimaryTab = "DASHBOARD" | "ACCOUNTS";
type AccountsSecondaryTab = "CREATE" | "LIST";
type VirtualPermanentTarget = "PV" | "PFL";

type VirtualPermanentAccount = {
  kind: "virtual";
  key: `PERMANENT_${VirtualPermanentTarget}`;
  full_name: string;
  username: string;
  role: "PERMANENT";
  email: string;
  target: VirtualPermanentTarget;
};

type ExistingAccountItem =
  | ({ kind: "user" } & AdminUser)
  | VirtualPermanentAccount;


function getRoleLabel(role: Role | "ALL") {
  if (role === "ALL") return "Tous les comptes";
  if (role === "ETABLISSEMENT") return "Technicentres";
  if (role === "PERMANENT") return "Permanents";
  if (role === "SUIVI") return "Visionnement demandes";
  return "Admins";
}

function getRoleOptionLabel(role: Role) {
  if (role === "ETABLISSEMENT") return "Technicentre";
  if (role === "PERMANENT") return "Permanent";
  if (role === "SUIVI") return "Visionnement demandes";
  return "Admin";
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasRestoredScroll = useRef(false);
  const restoreKey = "admin-dashboard-restore";
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Role | "ALL">("ALL");
  const [accountQuery, setAccountQuery] = useState("");
  const [accountsTab, setAccountsTab] = useState<AccountsSecondaryTab>("LIST");
  const [mailRouting, setMailRouting] = useState<AdminMailRoutingSettings>({
    permanent_pv_email: "",
    permanent_pfl_email: "",
  });
  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    outlook_email: "",
    role: "ETABLISSEMENT" as Role,
    establishment_id: "",
  });

  const primaryTab: AdminPrimaryTab = location.pathname === "/admin/accounts" ? "ACCOUNTS" : "DASHBOARD";

  async function loadUsers() {
    if (!token) return;
    const [userList, establishmentList, mailRoutingSettings] = await Promise.all([
      api.adminUsers(token),
      api.establishments(token),
      api.adminMailRouting(token),
    ]);
    setUsers(userList);
    setEstablishments(establishmentList);
    setMailRouting({
      permanent_pv_email: mailRoutingSettings.permanent_pv_email ?? "",
      permanent_pfl_email: mailRoutingSettings.permanent_pfl_email ?? "",
    });
  }

  useEffect(() => {
    loadUsers().catch((err) => setError(err instanceof Error ? err.message : "Erreur de chargement"));
  }, [token]);


  const virtualPermanentAccounts = useMemo<VirtualPermanentAccount[]>(
    () => [
      {
        kind: "virtual",
        key: "PERMANENT_PV",
        full_name: "Permanent PV",
        username: "permanent.pv.notification",
        role: "PERMANENT",
        email: mailRouting.permanent_pv_email ?? "",
        target: "PV",
      },
      {
        kind: "virtual",
        key: "PERMANENT_PFL",
        full_name: "Permanent PFL",
        username: "permanent.pfl.notification",
        role: "PERMANENT",
        email: mailRouting.permanent_pfl_email ?? "",
        target: "PFL",
      },
    ],
    [mailRouting.permanent_pfl_email, mailRouting.permanent_pv_email],
  );

  const filteredAccounts = useMemo<ExistingAccountItem[]>(() => {
    const query = accountQuery.trim().toLowerCase();
    const usersByCategory =
      selectedCategory === "ALL"
        ? users
        : users.filter((account) => account.role === selectedCategory);

    const accounts: ExistingAccountItem[] = usersByCategory.map((account) => ({
      ...account,
      kind: "user",
    }));

    if (selectedCategory === "ALL" || selectedCategory === "PERMANENT") {
      accounts.push(...virtualPermanentAccounts);
    }

    if (!query) return accounts;

    return accounts.filter((account) => {
      const haystack =
        account.kind === "user"
          ? `${account.full_name} ${account.username}`
          : `${account.full_name} ${account.username} ${account.email}`;
      return haystack.toLowerCase().includes(query);
    });
  }, [users, selectedCategory, accountQuery, virtualPermanentAccounts]);

  const roleStats = useMemo(
    () =>
      roleOptions.map((role) => ({
        role,
        count: users.filter((account) => account.role === role).length,
      })),
    [users],
  );

  const dashboardStats = useMemo(() => {
    const totalAccounts = users.length;
    const establishmentAccounts = users.filter((account) => account.role === "ETABLISSEMENT").length;
    const adminAccounts = users.filter((account) => account.role === "ADMIN").length;

    return [
      { label: "Comptes total", value: totalAccounts, helper: "Tous les profils disponibles dans la plateforme" },
      { label: "Admins", value: adminAccounts, helper: "Comptes avec droits de pilotage" },
      { label: "Technicentres", value: establishmentAccounts, helper: `${establishments.length} fiches configurées` },
      { label: "Profils actifs", value: totalAccounts, helper: "Comptes actuellement exploitables" },
    ];
  }, [users, establishments]);

  const newestAccounts = useMemo(
    () =>
      [...users]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [users],
  );

  useLayoutEffect(() => {
    if (hasRestoredScroll.current) return;
    if (users.length === 0) return;

    const savedState = sessionStorage.getItem(restoreKey);
    if (!savedState) return;

    try {
      const parsed = JSON.parse(savedState) as {
        path?: string;
        scrollY?: number;
        accountId?: number;
        selectedCategory?: Role | "ALL";
        accountQuery?: string;
        accountsTab?: AccountsSecondaryTab;
      };
      if (parsed.path !== location.pathname) return;

      if (parsed.selectedCategory) {
        setSelectedCategory(parsed.selectedCategory);
      }
      if (typeof parsed.accountQuery === "string") {
        setAccountQuery(parsed.accountQuery);
      }
      if (parsed.accountsTab) {
        setAccountsTab(parsed.accountsTab);
      }

      hasRestoredScroll.current = true;
      requestAnimationFrame(() => {
        if (typeof parsed.accountId === "number") {
          const target = document.getElementById(`admin-account-row-${parsed.accountId}`);
          if (target) {
            target.scrollIntoView({ block: "center", behavior: "auto" });
          } else if (typeof parsed.scrollY === "number") {
            window.scrollTo({ top: parsed.scrollY, behavior: "auto" });
          }
        } else if (typeof parsed.scrollY === "number") {
          window.scrollTo({ top: parsed.scrollY, behavior: "auto" });
        }

        sessionStorage.removeItem(restoreKey);
      });
    } catch {
      sessionStorage.removeItem(restoreKey);
    }
  }, [location.pathname, users]);

  function openAccount(accountId: number) {
    sessionStorage.setItem(
      restoreKey,
      JSON.stringify({
        path: location.pathname,
        scrollY: window.scrollY,
        accountId,
        selectedCategory,
        accountQuery,
        accountsTab,
      }),
    );
    navigate(`/admin/users/${accountId}`);
  }

  function openVirtualPermanent(target: VirtualPermanentTarget) {
    navigate(`/admin/permanents/${target.toLowerCase()}`);
  }

  return (
    <div className="space-y-6">
      {error ? <div className="panel border border-rose-200 p-4 text-sm text-rose-600">{error}</div> : null}
      {message ? <div className="panel border border-emerald-200 p-4 text-sm text-emerald-700">{message}</div> : null}

      {primaryTab === "DASHBOARD" ? (
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboardStats.map((item) => (
              <div key={item.label} className="panel p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-2 text-sm text-slate-500">{item.helper}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="panel p-6">
              <h3 className="text-xl font-semibold text-slate-950">Repartition des comptes</h3>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {roleStats.map((item) => (
                  <div key={item.role} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{getRoleLabel(item.role)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{getRoleOptionLabel(item.role)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2 text-lg font-semibold text-slate-950 shadow-sm">
                        {item.count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel p-6">
              <h3 className="text-xl font-semibold text-slate-950">Comptes recents</h3>
              <div className="mt-5 space-y-3">
                {newestAccounts.map((account) => (
                  <button
                    key={account.id}
                    id={`admin-account-row-${account.id}`}
                    type="button"
                    onClick={() => openAccount(account.id)}
                    className="w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-brand-200 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{account.full_name}</p>
                        <p className="mt-1 text-sm text-slate-500">{account.username} · {getRoleLabel(account.role)}</p>
                      </div>
                      <span className="text-xs text-slate-500">{formatDateTime(account.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

        </section>
      ) : accountsTab === "CREATE" ? (
        <section className="space-y-5">
          <div className="panel p-6">
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAccountsTab("CREATE")}
              className="btn-primary"
            >
              Nouveau compte
            </button>
            <button
              type="button"
              onClick={() => setAccountsTab("LIST")}
              className="btn-secondary"
            >
              Comptes existants
            </button>
          </div>

          <div className="mb-5">
            <h3 className="text-xl font-semibold text-slate-950">Créer un nouveau compte</h3>
            <p className="mt-1 text-sm text-slate-500">
              Configurez le profil puis affectez-le à un technicentre si nécessaire.
            </p>
          </div>

          <form
            className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!token) return;
              try {
                setError("");
                setMessage("");
                const payload = {
                  username: form.username,
                  password: form.password,
                  full_name: form.full_name,
                  outlook_email: form.outlook_email || null,
                  role: form.role,
                  establishment_id: null as number | null,
                };
                if (form.role === "ETABLISSEMENT") {
                  if (!form.establishment_id) {
                    throw new Error("Choisissez un technicentre");
                  }
                  payload.establishment_id = Number(form.establishment_id);
                }
                const created = await api.createAdminUser(token, payload);
                setMessage(`Compte ${created.username} créé`);
                setForm({
                  username: "",
                  password: "",
                  full_name: "",
                  outlook_email: "",
                  role: "ETABLISSEMENT",
                  establishment_id: "",
                });
                await loadUsers();
                navigate(`/admin/users/${created.id}`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur création compte");
              }
            }}
          >
            <div className="space-y-3">
              <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} />
              <input className="input" placeholder="Nom complet" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} />
              <input className="input" type="email" placeholder="Adresse email" value={form.outlook_email} onChange={(e) => setForm((prev) => ({ ...prev, outlook_email: e.target.value }))} />
              <input className="input" type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
              <select className="input" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as Role }))}>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{getRoleOptionLabel(role)}</option>
                ))}
              </select>
              <button className="btn-primary w-full" type="submit">Ajouter le compte</button>
            </div>

            {form.role === "ETABLISSEMENT" ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Technicentre associé</p>
                <select
                  className="input"
                  value={form.establishment_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, establishment_id: e.target.value }))}
                >
                  <option value="">Choisir un technicentre</option>
                  {establishments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                Les informations du technicentre s'affichent uniquement pour le rôle `ETABLISSEMENT`.
              </div>
            )}
          </form>
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="panel p-6">
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAccountsTab("CREATE")}
                className="btn-secondary"
              >
                Nouveau compte
              </button>
              <button
                type="button"
                onClick={() => setAccountsTab("LIST")}
                className="btn-primary"
              >
                Comptes existants
              </button>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Comptes existants</h3>
              </div>
              <div className="w-full lg:max-w-lg">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-brand-700">
                    Recherche rapide
                  </span>
                  <div className="relative rounded-2xl border border-brand-200 bg-white shadow-[0_12px_30px_-24px_rgba(249,115,22,0.65)] transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-500"
                    >
                      <path
                        d="M14.1667 14.1667L17.5 17.5M15.8333 9.16667C15.8333 12.8486 12.8486 15.8333 9.16667 15.8333C5.48477 15.8333 2.5 12.8486 2.5 9.16667C2.5 5.48477 5.48477 2.5 9.16667 2.5C12.8486 2.5 15.8333 5.48477 15.8333 9.16667Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <input
                      className="w-full rounded-2xl border-0 bg-transparent py-3 pl-12 pr-4 text-base text-slate-800 outline-none placeholder:text-slate-400"
                      placeholder="Chercher par nom ou username..."
                      value={accountQuery}
                      onChange={(e) => setAccountQuery(e.target.value)}
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(["ALL", ...roleOptions] as Array<Role | "ALL">).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedCategory(role)}
                  className={selectedCategory === role ? "btn-primary" : "btn-secondary"}
                >
                  {role === "ALL" ? "Tous" : getRoleOptionLabel(role)}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{filteredAccounts.length} résultat(s)</span>
              <span>{getRoleLabel(selectedCategory)}</span>
            </div>
          </div>

          <div className="space-y-4">
            {filteredAccounts.map((account) =>
              account.kind === "user" ? (
                <button
                  key={account.id}
                  id={`admin-account-row-${account.id}`}
                  type="button"
                  onClick={() => openAccount(account.id)}
                  className="panel w-full p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xl font-semibold text-slate-950">{account.full_name}</p>
                      <p className="mt-1 text-sm text-slate-500">{account.username} - {getRoleLabel(account.role)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                        {getRoleLabel(account.role)}
                      </span>
                      <span>Cree le {formatDateTime(account.created_at)}</span>
                      <span className="font-semibold text-brand-700">Ouvrir la fiche</span>
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  key={account.key}
                  type="button"
                  onClick={() => openVirtualPermanent(account.target)}
                  className="panel w-full p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xl font-semibold text-slate-950">{account.full_name}</p>
                      <p className="mt-1 text-sm text-slate-500">{account.username} - Notification exploitant</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700">
                        {account.target === "PV" ? "Permanent PV" : "Permanent PFL"}
                      </span>
                      <span className="font-semibold text-brand-700">Ouvrir la fiche</span>
                    </div>
                  </div>
                </button>
              ),
            )}

            {filteredAccounts.length === 0 ? (
              <div className="panel border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                Aucun compte dans ce filtre.
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

