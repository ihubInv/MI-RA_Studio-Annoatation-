import { Modal } from '@/components/ui/Modal'
import type { TemplateDocumentWarning } from '@/modules/video/templates/document'

interface ConfirmPublishModalProps {
  warnings: TemplateDocumentWarning[]
  onCancel: () => void
  onConfirm: () => void
  pending?: boolean
}

export function ConfirmPublishModal({ warnings, onCancel, onConfirm, pending }: ConfirmPublishModalProps) {
  return (
    <Modal
      title="Publish with warnings?"
      subtitle="This template has warnings. It can still be published after you confirm. Standard Video Annotation is unchanged until you assign it."
      onClose={onCancel}
    >
      <ul className="text-2xs text-amber-900 space-y-1 max-h-48 overflow-y-auto mb-4">
        {warnings.map((item) => (
          <li key={`${item.path}-${item.code}-${item.message}`}>
            {item.path ? `${item.path}: ` : ''}
            {item.message}
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <button type="button" className="mira-btn-ghost h-9" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="button" className="mira-btn-primary h-9 px-4" onClick={onConfirm} disabled={pending}>
          {pending ? 'Publishing…' : 'Publish anyway'}
        </button>
      </div>
    </Modal>
  )
}
