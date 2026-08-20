interface ModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}

export function Modal({ title, subtitle, onClose, children, wide }: ModalProps) {
  return (
    <div className="mira-modal-backdrop" onClick={onClose}>
      <div
        className={wide ? 'mira-modal mira-modal-wide fade-enter' : 'mira-modal fade-enter'}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mira-modal-title"
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 id="mira-modal-title" className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md text-muted-foreground hover:bg-white/80 hover:text-foreground text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
