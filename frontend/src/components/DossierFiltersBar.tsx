type FilterMetric = {
  label: string;
  value: number;
};

type StatusOption = {
  value: string;
  label: string;
};

export function DossierFiltersBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel = "Recherche rapide",
  statusValue,
  statusOptions = [],
  onStatusChange,
  statusLabel = "Statut",
  dateValue,
  onDateChange,
  onDateEnable,
  onDateClear,
  dateLabel = "Date",
  metrics = [],
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel?: string;
  statusValue?: string;
  statusOptions?: StatusOption[];
  onStatusChange?: (value: string) => void;
  statusLabel?: string;
  dateValue?: string;
  onDateChange?: (value: string) => void;
  onDateEnable?: () => void;
  onDateClear?: () => void;
  dateLabel?: string;
  metrics?: FilterMetric[];
}) {
  const hasStatus = Boolean(onStatusChange) && statusOptions.length > 0;
  const hasDate = Boolean(onDateChange);
  const hasDateToggle = Boolean(onDateEnable) && Boolean(onDateClear);

  return (
    <section className="panel border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        {hasDate ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{dateLabel}</span>
            {hasDateToggle ? (
              <div className="flex gap-2">
                <button type="button" className={dateValue ? "btn-secondary" : "btn-primary"} onClick={onDateClear}>
                  Toutes
                </button>
                <button type="button" className={dateValue ? "btn-primary" : "btn-secondary"} onClick={onDateEnable}>
                  Filtrer
                </button>
              </div>
            ) : null}
            {!hasDateToggle || dateValue ? (
              <input
                className="input"
                type="date"
                value={dateValue ?? ""}
                onChange={(event) => onDateChange?.(event.target.value)}
              />
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{searchLabel}</span>
          <input
            className="input"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
          {hasStatus ? (
            <select
              className="input"
              value={statusValue ?? "ALL"}
              onChange={(event) => onStatusChange?.(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {metrics.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {metrics.map((item) => (
              <div key={item.label} className="metric-card">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
