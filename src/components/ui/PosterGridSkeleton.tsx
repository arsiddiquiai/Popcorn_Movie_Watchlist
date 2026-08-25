/** The one loading treatment used for anywhere a poster grid or row is about to appear — a shaped placeholder beats a spinner floating in empty space. */
export function PosterGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    // Matches the standard poster grid's own column/gap scale (DESIGN.md
    // §3) — this drifted out of sync when that grid was introduced
    // elsewhere; fixed here so the loading state doesn't reflow into a
    // different column count once results arrive.
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6 lg:gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="shimmer aspect-[2/3] rounded-poster" />
          <div className="shimmer h-3 w-3/4 rounded-full" />
          <div className="shimmer h-3 w-1/3 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function PosterRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-x-hidden">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="shimmer aspect-[2/3] w-36 shrink-0 rounded-lg border border-border sm:w-40" />
      ))}
    </div>
  )
}
