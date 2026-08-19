import { Field } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { TEMPLATE_TOOL_LABELS } from '@/modules/video/templates/authoring'
import { creatorLabel, formatTemplateDate, previewSections } from '@/modules/video/templates/summary'
import { normalizeTimelineTracks } from '@/modules/video/templates/timelineTracks'
import type { VideoTemplateRecord } from '@/modules/video/templates/types'

interface TemplatePreviewModalProps {
  record: VideoTemplateRecord
  onClose: () => void
}

export function TemplatePreviewModal({ record, onClose }: TemplatePreviewModalProps) {
  const preview = previewSections(record)

  return (
    <Modal
      xl
      title={record.name}
      subtitle="Preview only. Standard Video Annotation projects are not affected."
      onClose={onClose}
    >
      <div className="space-y-3 max-h-[min(70vh,560px)] overflow-y-auto pr-0.5 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Status">
            <p className="capitalize">{record.status || 'draft'}</p>
          </Field>
          <Field label="Version">
            <p>v{record.version}</p>
          </Field>
          <Field label="Created by">
            <p>{creatorLabel(record)}</p>
          </Field>
          <Field label="Updated">
            <p>{formatTemplateDate(record.updated_at)}</p>
          </Field>
        </div>
        <p className="text-muted-foreground">{record.description || preview.doc.template.description || 'No description'}</p>
        <div>
          <p className="mira-section-label mb-1.5">Enabled tools ({preview.enabledTools.length})</p>
          <p className="text-muted-foreground">
            {preview.enabledTools.map((id) => TEMPLATE_TOOL_LABELS[id]).join(', ') || 'None'}
          </p>
        </div>
        <div>
          <p className="mira-section-label mb-1.5">Labels ({preview.labels.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {preview.labels.map((label) => (
              <li
                key={label.id}
                className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: label.color }} />
                {label.name}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mira-section-label mb-1.5">Events ({preview.events.length})</p>
          <p className="text-muted-foreground">
            {preview.events.map((item) => item.name).join(', ') || 'None'}
          </p>
        </div>
        <div>
          <p className="mira-section-label mb-1.5">Actions ({preview.actions.length})</p>
          <p className="text-muted-foreground">
            {preview.actions.map((item) => item.name).join(', ') || 'None'}
          </p>
        </div>
        <div>
          <p className="mira-section-label mb-1.5">Relationships ({preview.relations.length})</p>
          <p className="text-muted-foreground">
            {preview.relations
              .map((item) => {
                const arrow = item.directional === false ? '↔' : '→'
                return `${item.source_label || 'any'} ${arrow} ${item.name} ${arrow} ${item.target_label || 'any'}`
              })
              .join(', ') || 'None'}
          </p>
        </div>
        <div>
          <p className="mira-section-label mb-1.5">Timeline</p>
          <p className="text-muted-foreground">
            {normalizeTimelineTracks(preview.doc.timeline)
              .filter((row) => row.enabled)
              .map((row) => row.display_name || row.id.replace(/_/g, ' '))
              .join(', ') || 'None'}
          </p>
        </div>
        <div>
          <p className="mira-section-label mb-1.5">AI</p>
          <p className="text-muted-foreground">{preview.ai.enabled === false ? 'Disabled' : 'Enabled'}</p>
        </div>
        <div>
          <p className="mira-section-label mb-1.5">Export</p>
          <p className="text-muted-foreground">{preview.exportFormats.join(', ') || 'json'}</p>
        </div>
      </div>
    </Modal>
  )
}
