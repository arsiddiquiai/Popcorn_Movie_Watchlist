/** The one loading treatment used for anywhere a poster grid or row is about to appear — a shaped placeholder beats a spinner floating in empty space. */
export function PosterGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-surface" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface" />
        </div>
      ))}
    </div>
  )
}

export function PosterRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-x-hidden">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-lg bg-surface sm:w-40" />
      ))}
    </div>
  )
}
