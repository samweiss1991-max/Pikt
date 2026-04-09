export default function SkeletonCard({ count = 2 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="pikt-card animate-pulse bg-surface-container-lowest border border-outline-variant p-6 flex flex-col gap-4"
        >
          {/* Header row */}
          <div className="flex items-start gap-4">
            <div className="w-32 h-32 rounded-lg bg-surface-container-high" />
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-8 w-64 max-w-full bg-surface-container-high rounded-lg" />
              <div className="h-4 w-48 max-w-full bg-surface-container-high rounded-lg" />
            </div>
          </div>
          {/* Tags row */}
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-surface-container-high" />
            <div className="h-6 w-16 rounded-full bg-surface-container-high" />
            <div className="h-6 w-16 rounded-full bg-surface-container-high" />
          </div>
          {/* Body lines */}
          <div className="flex flex-col gap-2">
            <div className="h-4 w-full bg-surface-container-high rounded-lg" />
            <div className="h-4 w-4/5 bg-surface-container-high rounded-lg" />
            <div className="h-4 w-3/5 bg-surface-container-high rounded-lg" />
          </div>
          {/* CTA row */}
          <div className="h-10 w-36 bg-surface-container-high rounded-lg mt-auto" />
        </div>
      ))}
    </>
  )
}
