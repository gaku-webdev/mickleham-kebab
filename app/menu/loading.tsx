import Skeleton from "@/components/Skeleton";

function MenuCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="overflow-hidden rounded-xl border border-[#E8DED2] bg-white"
    >
      <Skeleton className="aspect-[1.55] rounded-none" />
      <div className="flex min-h-[104px] flex-col gap-2 p-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2.5 w-2/3" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
      </div>
    </article>
  );
}

export default function MenuLoading() {
  return (
    <main
      aria-label="Loading menu"
      aria-busy="true"
      className="min-h-screen bg-[#FAF7F2] px-4 pb-24 text-[#1C1917] sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg sm:max-w-xs" />
        </div>

        <div className="-mx-4 flex gap-5 overflow-hidden border-b border-[#E8DED2] px-4 pb-3 sm:mx-0 sm:px-0">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-3 w-16 shrink-0" />
          ))}
        </div>

        <div className="grid gap-5 pt-4 min-[700px]:grid-cols-[minmax(0,1fr)_185px]">
          <section aria-label="Loading menu items">
            <div className="mb-3 flex min-h-6 items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <MenuCardSkeleton key={index} />
              ))}
            </div>
          </section>

          <aside
            aria-hidden="true"
            className="hidden min-[700px]:block"
          >
            <div className="sticky top-24 space-y-4 rounded-xl border border-[#E8DED2] bg-white p-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </aside>
        </div>
      </div>
      <p role="status" className="sr-only">
        Loading menu items...
      </p>
    </main>
  );
}
