'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { BehaviorBlock as BehaviorBlockType } from '@/lib/crm/assessment/assessment.schema'
import { AttachmentUploader } from '@/components/crm/assessment/AttachmentUploader'

type AttachmentRecord = {
  id: string
  sectionKey: string
  fileName: string
  mimeType: string
}

type BehaviorBlockProps = {
  index: number
  block: BehaviorBlockType
  onChange: (block: BehaviorBlockType) => void
  onRemove?: () => void
  readOnly?: boolean
  onBlur?: () => void
  clientId: string
  assessmentId: string
  attachments: AttachmentRecord[]
  onUploaded: () => void
}

export function BehaviorBlockEditor({
  index,
  block,
  onChange,
  onRemove,
  readOnly,
  onBlur,
  clientId,
  assessmentId,
  attachments,
  onUploaded,
}: BehaviorBlockProps) {
  const set = <K extends keyof BehaviorBlockType>(key: K, value: BehaviorBlockType[K]) =>
    onChange({ ...block, [key]: value })

  const graphKey = `behaviors[${index}].graph`
  const mapKey = `behaviors[${index}].contingencyMap`

  return (
    <div className="space-y-3 rounded-lg border border-line p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-ink">Behavior {index + 1}</h4>
        {onRemove && !readOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <Field label="Operational Definition">
        <Textarea
          value={block.operationalDefinition}
          onChange={(e) => set('operationalDefinition', e.target.value)}
          onBlur={onBlur}
          readOnly={readOnly}
          rows={2}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Severity">
          <Input
            value={block.severity}
            onChange={(e) => set('severity', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </Field>
        <Field label="Example">
          <Input
            value={block.example}
            onChange={(e) => set('example', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </Field>
        <Field label="Non-example">
          <Input
            value={block.nonExample}
            onChange={(e) => set('nonExample', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </Field>
        <Field label="Hypothesized Function">
          <Input
            value={block.hypothesizedFunction}
            onChange={(e) => set('hypothesizedFunction', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </Field>
        <Field label="Onset">
          <Input
            value={block.onset}
            onChange={(e) => set('onset', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </Field>
        <Field label="Offset">
          <Input
            value={block.offset}
            onChange={(e) => set('offset', e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
          />
        </Field>
      </div>
      <Field label="Measurement">
        <Select
          value={block.measurement ?? ''}
          onValueChange={(v) =>
            set('measurement', v as BehaviorBlockType['measurement'])
          }
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue placeholder="Frequency / Duration / Both" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FREQUENCY">Frequency</SelectItem>
            <SelectItem value="DURATION">Duration</SelectItem>
            <SelectItem value="BOTH">Both</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Baseline Measurement/Graph">
        <Textarea
          value={block.baselineMeasurement}
          onChange={(e) => set('baselineMeasurement', e.target.value)}
          onBlur={onBlur}
          readOnly={readOnly}
          rows={2}
        />
        <AttachmentUploader
          clientId={clientId}
          assessmentId={assessmentId}
          sectionKey={graphKey}
          kind="IMAGE"
          accept="image/*"
          attachments={attachments}
          readOnly={readOnly}
          onUploaded={onUploaded}
          label="Upload graph"
        />
      </Field>
      {(
        [
          ['interventionPlans', 'Intervention Plans'],
          ['preventionStrategies', 'Prevention Strategies'],
          ['replacementStrategies', 'Replacement Strategies'],
          ['responseStrategies', 'Response Strategies'],
          ['antecedentsSettingEvents', 'Antecedents / Setting Events of Behavior'],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <Textarea
            value={block[key]}
            onChange={(e) => set(key, e.target.value)}
            onBlur={onBlur}
            readOnly={readOnly}
            rows={2}
          />
        </Field>
      ))}
      <Field label="Visual Behavior Intervention Contingency Mapping">
        <AttachmentUploader
          clientId={clientId}
          assessmentId={assessmentId}
          sectionKey={mapKey}
          kind="IMAGE"
          accept="image/*"
          attachments={attachments}
          readOnly={readOnly}
          onUploaded={onUploaded}
          label="Upload contingency map"
        />
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
