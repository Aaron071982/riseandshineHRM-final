'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AttachmentUploader } from '@/components/crm/assessment/AttachmentUploader'
import { PrefilledTextArea } from '@/components/crm/assessment/PrefilledTextArea'
import {
  aflsLatestProtocolValue,
  aflsLatestSkillAreaValue,
  AFLS_SCORE_OPTIONS,
  getOrderedAflsDates,
  setAflsSkillScoreDateColumns,
} from '@/lib/crm/assessment/afls'
import {
  emptyAflsProtocol,
  emptyAflsSkill,
  emptyAflsSkillArea,
  emptyAflsSkillScore,
  emptyAflsSummaryScore,
  type AflsPresentLevel,
} from '@/lib/crm/assessment/assessment.schema'

type AttachmentRecord = {
  id: string
  sectionKey: string
  fileName: string
  mimeType: string
}

type AflsEditorProps = {
  clientId: string
  assessmentId: string
  value: AflsPresentLevel
  onChange: (next: AflsPresentLevel) => void
  readOnly?: boolean
  onBlur?: () => void
  attachments: AttachmentRecord[]
  onUploaded: () => void
}

export function AflsEditor(props: AflsEditorProps) {
  const dates = getOrderedAflsDates(props.value)

  const setProtocols = (
    updater: (protocols: AflsPresentLevel['protocols']) => AflsPresentLevel['protocols']
  ) => {
    props.onChange({ ...props.value, protocols: updater(props.value.protocols) })
  }

  const addDateColumn = () => {
    const date = window.prompt('Assessment date (YYYY-MM-DD)')
    if (!date?.trim()) return
    props.onChange(setAflsSkillScoreDateColumns(props.value, [...dates, date.trim()]))
  }

  return (
    <div className="space-y-4">
      <AttachmentUploader
        clientId={props.clientId}
        assessmentId={props.assessmentId}
        sectionKey="present_levels.afls"
        kind="AUTO"
        accept=".pdf,.png,.jpg,.jpeg,.heic,.webp,application/pdf,image/*"
        multiple
        attachments={props.attachments}
        readOnly={props.readOnly}
        onUploaded={props.onUploaded}
        label="Upload AFLS grid (PDF or image)"
        hint="Clinic-supplied AFLS sheets only · up to 50 MB"
      />

      {props.value.legacyMigratedFromAtec && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Legacy text mentioning AFLS was copied from the old ATEC field so it is preserved.
        </p>
      )}

      <PrefilledTextArea
        label="AFLS Interpretation"
        value={props.value.interpretation}
        onChange={(interpretation) =>
          props.onChange({ ...props.value, interpretation })
        }
        readOnly={props.readOnly}
        onBlur={props.onBlur}
      />

      <div className="space-y-3 rounded-lg border border-line p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h5 className="font-medium text-ink">Mode A: Summary Scores</h5>
            <p className="text-sm text-quiet">
              Enter protocol and skill-area rollup scores over time.
            </p>
          </div>
          {!props.readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={() => setProtocols((protocols) => [...protocols, emptyAflsProtocol()])}>
              Add protocol
            </Button>
          )}
        </div>

        {props.value.protocols.length === 0 && (
          <p className="text-sm text-quiet">No AFLS protocols added yet.</p>
        )}

        {props.value.protocols.map((protocol, protocolIndex) => (
          <div key={protocol.id} className="space-y-3 rounded-lg border border-line bg-canvas/40 p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-quiet">Protocol key</span>
                <Input
                  value={protocol.key}
                  onChange={(e) =>
                    setProtocols((protocols) =>
                      protocols.map((item, index) =>
                        index === protocolIndex ? { ...item, key: e.target.value } : item
                      )
                    )
                  }
                  onBlur={props.onBlur}
                  readOnly={props.readOnly}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-quiet">Protocol label</span>
                <Input
                  value={protocol.label}
                  onChange={(e) =>
                    setProtocols((protocols) =>
                      protocols.map((item, index) =>
                        index === protocolIndex ? { ...item, label: e.target.value } : item
                      )
                    )
                  }
                  onBlur={props.onBlur}
                  readOnly={props.readOnly}
                />
              </label>
              <div className="flex items-end">
                {!props.readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setProtocols((protocols) =>
                        protocols.filter((_, index) => index !== protocolIndex)
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <SummaryScoreTable
              title="Protocol summary scores"
              points={protocol.summaryScores}
              readOnly={props.readOnly}
              onBlur={props.onBlur}
              onChange={(summaryScores) =>
                setProtocols((protocols) =>
                  protocols.map((item, index) =>
                    index === protocolIndex ? { ...item, summaryScores } : item
                  )
                )
              }
            />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h6 className="text-sm font-medium text-ink">Skill areas</h6>
                {!props.readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setProtocols((protocols) =>
                        protocols.map((item, index) =>
                          index === protocolIndex
                            ? { ...item, skillAreas: [...item.skillAreas, emptyAflsSkillArea()] }
                            : item
                        )
                      )
                    }
                  >
                    Add skill area
                  </Button>
                )}
              </div>

              {protocol.skillAreas.map((area, areaIndex) => (
                <div key={area.id} className="space-y-3 rounded-lg border border-line bg-white p-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-quiet">Area code</span>
                      <Input
                        value={area.code}
                        onChange={(e) =>
                          setProtocols((protocols) =>
                            protocols.map((item, index) =>
                              index === protocolIndex
                                ? {
                                    ...item,
                                    skillAreas: item.skillAreas.map((skillArea, innerIndex) =>
                                      innerIndex === areaIndex
                                        ? { ...skillArea, code: e.target.value }
                                        : skillArea
                                    ),
                                  }
                                : item
                            )
                          )
                        }
                        onBlur={props.onBlur}
                        readOnly={props.readOnly}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-quiet">Area label</span>
                      <Input
                        value={area.label}
                        onChange={(e) =>
                          setProtocols((protocols) =>
                            protocols.map((item, index) =>
                              index === protocolIndex
                                ? {
                                    ...item,
                                    skillAreas: item.skillAreas.map((skillArea, innerIndex) =>
                                      innerIndex === areaIndex
                                        ? { ...skillArea, label: e.target.value }
                                        : skillArea
                                    ),
                                  }
                                : item
                            )
                          )
                        }
                        onBlur={props.onBlur}
                        readOnly={props.readOnly}
                      />
                    </label>
                    <div className="flex items-end">
                      {!props.readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setProtocols((protocols) =>
                              protocols.map((item, index) =>
                                index === protocolIndex
                                  ? {
                                      ...item,
                                      skillAreas: item.skillAreas.filter(
                                        (_, innerIndex) => innerIndex !== areaIndex
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  <SummaryScoreTable
                    title="Skill-area summary scores"
                    points={area.summaryScores}
                    readOnly={props.readOnly}
                    onBlur={props.onBlur}
                    onChange={(summaryScores) =>
                      setProtocols((protocols) =>
                        protocols.map((item, index) =>
                          index === protocolIndex
                            ? {
                                ...item,
                                skillAreas: item.skillAreas.map((skillArea, innerIndex) =>
                                  innerIndex === areaIndex
                                    ? { ...skillArea, summaryScores }
                                    : skillArea
                                ),
                              }
                            : item
                        )
                      )
                    }
                  />

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h6 className="text-sm font-medium text-ink">
                        Mode B: Structured skill grid
                      </h6>
                      <div className="flex flex-wrap gap-2">
                        {!props.readOnly && (
                          <Button type="button" variant="outline" size="sm" onClick={addDateColumn}>
                            Add date column
                          </Button>
                        )}
                        {!props.readOnly && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setProtocols((protocols) =>
                                protocols.map((item, index) =>
                                  index === protocolIndex
                                    ? {
                                        ...item,
                                        skillAreas: item.skillAreas.map((skillArea, innerIndex) =>
                                          innerIndex === areaIndex
                                            ? {
                                                ...skillArea,
                                                skills: [
                                                  ...skillArea.skills,
                                                  {
                                                    ...emptyAflsSkill(),
                                                    scores: dates.map((date) => emptyAflsSkillScore(date)),
                                                  },
                                                ],
                                              }
                                            : skillArea
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            Add skill
                          </Button>
                        )}
                      </div>
                    </div>

                    <AflsSkillGrid
                      area={area}
                      dates={dates}
                      readOnly={props.readOnly}
                      onBlur={props.onBlur}
                      onChange={(nextArea) =>
                        setProtocols((protocols) =>
                          protocols.map((item, index) =>
                            index === protocolIndex
                              ? {
                                  ...item,
                                  skillAreas: item.skillAreas.map((skillArea, innerIndex) =>
                                    innerIndex === areaIndex ? nextArea : skillArea
                                  ),
                                }
                              : item
                          )
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AflsCharts afls={props.value} />
    </div>
  )
}

function SummaryScoreTable({
  title,
  points,
  onChange,
  readOnly,
  onBlur,
}: {
  title: string
  points: AflsPresentLevel['protocols'][number]['summaryScores']
  onChange: (points: AflsPresentLevel['protocols'][number]['summaryScores']) => void
  readOnly?: boolean
  onBlur?: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{title}</p>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...points, emptyAflsSummaryScore()])}>
            Add score
          </Button>
        )}
      </div>
      {points.length === 0 ? (
        <p className="text-sm text-quiet">No summary scores yet.</p>
      ) : (
        <div className="space-y-2">
          {points.map((point, index) => (
            <div key={point.id} className="grid gap-2 md:grid-cols-[180px_140px_auto]">
              <Input
                type="date"
                value={point.date}
                onChange={(e) =>
                  onChange(
                    points.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, date: e.target.value } : item
                    )
                  )
                }
                onBlur={onBlur}
                readOnly={readOnly}
              />
              <Input
                type="number"
                step="0.01"
                min={0}
                value={point.value ?? ''}
                onChange={(e) =>
                  onChange(
                    points.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            value: e.target.value.trim() ? Number(e.target.value) : null,
                          }
                        : item
                    )
                  )
                }
                onBlur={onBlur}
                readOnly={readOnly}
                placeholder="Summary score"
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(points.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AflsSkillGrid({
  area,
  dates,
  readOnly,
  onBlur,
  onChange,
}: {
  area: AflsPresentLevel['protocols'][number]['skillAreas'][number]
  dates: string[]
  readOnly?: boolean
  onBlur?: () => void
  onChange: (area: AflsPresentLevel['protocols'][number]['skillAreas'][number]) => void
}) {
  if (area.skills.length === 0) {
    return <p className="text-sm text-quiet">No structured skills added.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[800px] w-full border border-line text-xs">
        <thead className="bg-canvas/60">
          <tr>
            <th className="p-2 text-left">Code</th>
            <th className="p-2 text-left">Label</th>
            {dates.map((date) => (
              <th key={date} className="p-2 text-left">
                {date || 'Date'}
              </th>
            ))}
            {!readOnly && <th className="p-2" />}
          </tr>
        </thead>
        <tbody>
          {area.skills.map((skill, skillIndex) => (
            <tr key={skill.id} className="border-t border-line">
              <td className="p-1 align-top">
                <Input
                  value={skill.code}
                  onChange={(e) =>
                    onChange({
                      ...area,
                      skills: area.skills.map((item, index) =>
                        index === skillIndex ? { ...item, code: e.target.value } : item
                      ),
                    })
                  }
                  onBlur={onBlur}
                  readOnly={readOnly}
                  className="text-xs"
                />
              </td>
              <td className="p-1 align-top">
                <Input
                  value={skill.label}
                  onChange={(e) =>
                    onChange({
                      ...area,
                      skills: area.skills.map((item, index) =>
                        index === skillIndex ? { ...item, label: e.target.value } : item
                      ),
                    })
                  }
                  onBlur={onBlur}
                  readOnly={readOnly}
                  className="text-xs"
                />
              </td>
              {dates.map((date) => {
                const score =
                  skill.scores.find((item) => item.date === date) ??
                  emptyAflsSkillScore(date)
                const numericValue =
                  typeof score.value === 'number' ? String(score.value) : score.value ?? ''
                return (
                  <td key={date} className={`p-1 align-top ${scoreCellClass(score.value)}`}>
                    <select
                      value={numericValue}
                      onChange={(e) =>
                        onChange({
                          ...area,
                          skills: area.skills.map((item, index) =>
                            index === skillIndex
                              ? {
                                  ...item,
                                  scores: dates.map((columnDate) => {
                                    const existing =
                                      item.scores.find((entry) => entry.date === columnDate) ??
                                      emptyAflsSkillScore(columnDate)
                                    if (columnDate !== date) return existing
                                    return {
                                      ...existing,
                                      value:
                                        e.target.value === ''
                                          ? null
                                          : e.target.value === 'N/A'
                                            ? 'N/A'
                                            : Number(e.target.value),
                                    }
                                  }),
                                }
                              : item
                          ),
                        })
                      }
                      onBlur={onBlur}
                      disabled={readOnly}
                      className="w-full rounded border border-line bg-white px-1 py-1 text-xs"
                    >
                      <option value="">—</option>
                      {AFLS_SCORE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                )
              })}
              {!readOnly && (
                <td className="p-1 align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange({
                        ...area,
                        skills: area.skills.filter((_, index) => index !== skillIndex),
                      })
                    }
                  >
                    Remove
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function scoreCellClass(value: number | 'N/A' | null | undefined): string {
  if (value === 'N/A') return 'bg-slate-100'
  if (value === 4) return 'bg-green-200'
  if (value === 3) return 'bg-green-100'
  if (value === 2) return 'bg-amber-100'
  if (value === 1) return 'bg-orange-100'
  if (value === 0) return 'bg-red-50'
  return ''
}

export function AflsCharts({ afls }: { afls: AflsPresentLevel }) {
  const protocolSeries = afls.protocols
    .map((protocol) => ({
      label: protocol.label || protocol.key || 'Protocol',
      value: aflsLatestProtocolValue(protocol),
    }))
    .filter((item) => item.value != null) as { label: string; value: number }[]

  const areaSeries = afls.protocols.flatMap((protocol) =>
    protocol.skillAreas
      .map((area) => ({
        label: area.label || area.code || protocol.label || protocol.key || 'Skill area',
        value: aflsLatestSkillAreaValue(area),
      }))
      .filter((item) => item.value != null) as { label: string; value: number }[]
  )

  if (protocolSeries.length === 0 && areaSeries.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 rounded-lg border border-line p-3">
      <div>
        <h5 className="font-medium text-ink">AFLS graphs</h5>
        <p className="text-sm text-quiet">
          Graphs use the latest summary scores entered above.
        </p>
      </div>
      {protocolSeries.length > 0 && (
        <SimpleBarChart title="Protocol summary scores" rows={protocolSeries} />
      )}
      {areaSeries.length > 0 && (
        <SimpleBarChart title="Skill-area summary scores" rows={areaSeries} />
      )}
    </div>
  )
}

function SimpleBarChart({
  title,
  rows,
}: {
  title: string
  rows: { label: string; value: number }[]
}) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">{title}</p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`} className="grid gap-2 md:grid-cols-[220px_1fr_64px] items-center">
            <div className="text-xs text-ink">{row.label}</div>
            <div className="h-4 rounded bg-canvas overflow-hidden">
              <div
                className="h-full rounded bg-brand/70"
                style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
              />
            </div>
            <div className="text-right text-xs text-quiet">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
