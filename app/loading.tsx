import Skeleton from "@/components/Skeleton";

export default function Loading() {
  return (
    <main
      aria-label="Loading page"
      aria-busy="true"
      className="min-h-[70vh] flex-1 bg-[#FAF7F2] px-4 py-8 text-[#1C1917] sm:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <section
              key={index}
              className="space-y-4 rounded-2xl border border-[#EBE6DD] bg-white p-5"
            >
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </section>
          ))}
        </div>
      </div>
      <p role="status" className="sr-only">
        Loading page...
      </p>
    </main>
  );
}
