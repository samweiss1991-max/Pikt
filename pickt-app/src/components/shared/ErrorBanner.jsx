import { COPY } from '../../lib/copy'

export default function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-container-high border border-error/20">
      <span className="material-symbols-outlined text-error">error_outline</span>
      <span className="text-sm font-medium text-on-surface">
        {message || COPY.errors.generic}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm font-bold text-primary hover:underline ml-auto focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          {COPY.errors.retry}
        </button>
      )}
    </div>
  )
}
