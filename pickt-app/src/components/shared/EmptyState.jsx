export default function EmptyState({ icon = 'inbox', message, ctaLabel, onCta }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 text-center gap-4">
      <span className="material-symbols-outlined text-6xl text-on-surface-variant opacity-30">
        {icon}
      </span>
      <p className="text-lg font-bold text-on-surface-variant">{message}</p>
      {ctaLabel && (
        <button
          onClick={onCta}
          className="bg-primary text-on-primary px-6 py-2 rounded-lg font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
