type PageSkeletonProps = {
  label?: string;
};

export function PageSkeleton({ label = "Chargement de l'interface" }: PageSkeletonProps) {
  return (
    <div className="min-h-screen px-4 py-5 md:px-8 md:py-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.35)] md:px-8">
          <div className="flex flex-col gap-6">
            <div className="h-4 w-32 rounded-full bg-slate-200/80" />
            <div className="space-y-3">
              <div className="h-9 w-full max-w-2xl rounded-2xl bg-slate-200/80" />
              <div className="h-4 w-full max-w-3xl rounded-full bg-slate-100" />
              <div className="h-4 w-full max-w-2xl rounded-full bg-slate-100" />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="h-11 w-40 rounded-full bg-slate-200/80" />
              <div className="h-11 w-40 rounded-full bg-slate-200/80" />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.2)]">
              <div className="mb-4 h-5 w-40 rounded-full bg-slate-200/80" />
              <div className="space-y-3">
                <div className="h-4 w-full rounded-full bg-slate-100" />
                <div className="h-4 w-[94%] rounded-full bg-slate-100" />
                <div className="h-4 w-[82%] rounded-full bg-slate-100" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.18)]"
                >
                  <div className="mb-4 h-4 w-24 rounded-full bg-brand-100/70" />
                  <div className="space-y-3">
                    <div className="h-6 w-3/4 rounded-xl bg-slate-200/80" />
                    <div className="h-4 w-full rounded-full bg-slate-100" />
                    <div className="h-4 w-[86%] rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.2)]">
            <div className="mb-5 h-5 w-32 rounded-full bg-slate-200/80" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-[1.3rem] border border-slate-100 p-4">
                  <div className="mb-3 h-4 w-28 rounded-full bg-slate-200/80" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-full rounded-full bg-slate-100" />
                    <div className="h-3.5 w-[88%] rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}
