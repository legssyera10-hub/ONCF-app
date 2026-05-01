import { Link } from "react-router-dom";

type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function PageBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Fil d'ariane" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.to && !isLast ? (
              <Link to={item.to} className="transition hover:text-slate-800">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-semibold text-slate-900" : ""}>{item.label}</span>
            )}
            {!isLast ? <span className="text-slate-300">/</span> : null}
          </div>
        );
      })}
    </nav>
  );
}
