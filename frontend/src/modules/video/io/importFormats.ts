import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { newObjectId, type VideoRectObject } from '@/modules/video/canvas/types'

export type ImportFormat = 'json' | 'yolo' | 'coco' | 'mot' | 'cvat' | 'labelme' | 'custom'

function emptyStore(): VideoAnnotationStore {
  return {
    version: 7,
    rects: [],
    skeletons: [],
    masks: [],
    events: [],
    actions: [],
    relations: [],
    trajectories: [],
    audio_segments: [],
    speaker_labels: [],
    transcriptions: [],
    scenes: [],
  }
}

function rect(partial: Partial<VideoRectObject> & Pick<VideoRectObject, 'x' | 'y' | 'width' | 'height'>): VideoRectObject {
  return {
    id: newObjectId(),
    object_id: partial.object_id ?? 'Object_001',
    label: partial.label ?? 'Object',
    frame: partial.frame ?? 0,
    tool_type: 'bbox',
    color: partial.color ?? '#0d559e',
    visible: true,
    ...partial,
  }
}

export function importNativeJson(text: string): VideoAnnotationStore {
  const parsed = JSON.parse(text)
  if (Array.isArray(parsed?.rects) || parsed?.version) {
    return { ...emptyStore(), ...parsed, version: 7 }
  }
  throw new Error('Not a MI-RA JSON annotation file')
}

export function importYolo(text: string, width: number, height: number, classNames: string[], frame = 0): VideoRectObject[] {
  const rects: VideoRectObject[] = []
  for (const line of text.split(/\r?\n/)) {
    const p = line.trim().split(/\s+/)
    if (p.length < 5) continue
    const cls = Number(p[0])
    const xc = Number(p[1]) * width
    const yc = Number(p[2]) * height
    const w = Number(p[3]) * width
    const h = Number(p[4]) * height
    if (![xc, yc, w, h].every(Number.isFinite)) continue
    rects.push(
      rect({
        object_id: `YOLO_${String(rects.length + 1).padStart(3, '0')}`,
        label: classNames[cls] ?? `class_${cls}`,
        frame,
        x: xc - w / 2,
        y: yc - h / 2,
        width: w,
        height: h,
      }),
    )
  }
  return rects
}

export function importCoco(text: string): VideoRectObject[] {
  const coco = JSON.parse(text)
  const cats = new Map<number, string>((coco.categories ?? []).map((c: { id: number; name: string }) => [c.id, c.name]))
  return (coco.annotations ?? []).map((a: { bbox: number[]; category_id: number; attributes?: { frame?: number; object_id?: string } }, i: number) =>
    rect({
      object_id: a.attributes?.object_id ?? `COCO_${String(i + 1).padStart(3, '0')}`,
      label: cats.get(a.category_id) ?? 'Object',
      frame: a.attributes?.frame ?? 0,
      x: a.bbox[0],
      y: a.bbox[1],
      width: a.bbox[2],
      height: a.bbox[3],
    }),
  )
}

export function importMot(text: string): VideoRectObject[] {
  const rects: VideoRectObject[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue
    const p = line.split(',')
    if (p.length < 6) continue
    const frame = Number(p[0]) - 1
    const tid = p[1]
    rects.push(
      rect({
        object_id: `Track_${tid}`,
        label: 'Object',
        frame: Math.max(0, frame),
        x: Number(p[2]),
        y: Number(p[3]),
        width: Number(p[4]),
        height: Number(p[5]),
      }),
    )
  }
  return rects
}

export function importCvat(xml: string): VideoRectObject[] {
  const rects: VideoRectObject[] = []
  const trackRe = /<track[^>]*label="([^"]*)"[^>]*>([\s\S]*?)<\/track>/g
  let tm: RegExpExecArray | null
  let n = 0
  while ((tm = trackRe.exec(xml))) {
    n += 1
    const label = tm[1]
    const oid = `${label}_${String(n).padStart(3, '0')}`
    const boxRe = /<box[^>]*frame="(\d+)"[^>]*xtl="([^"]+)"[^>]*ytl="([^"]+)"[^>]*xbr="([^"]+)"[^>]*ybr="([^"]+)"/g
    let bm: RegExpExecArray | null
    while ((bm = boxRe.exec(tm[2]))) {
      const xtl = Number(bm[2])
      const ytl = Number(bm[3])
      rects.push(
        rect({
          object_id: oid,
          label,
          frame: Number(bm[1]),
          x: xtl,
          y: ytl,
          width: Number(bm[4]) - xtl,
          height: Number(bm[5]) - ytl,
        }),
      )
    }
  }
  return rects
}

export function importLabelMe(text: string): VideoRectObject[] {
  const doc = JSON.parse(text)
  const shapes = doc.shapes ?? []
  return shapes
    .filter((s: { shape_type?: string }) => s.shape_type === 'rectangle' || s.shape_type === 'bbox')
    .map((s: { label?: string; points: number[][] }, i: number) => {
      const xs = s.points.map((p) => p[0])
      const ys = s.points.map((p) => p[1])
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return rect({
        object_id: `LM_${String(i + 1).padStart(3, '0')}`,
        label: s.label ?? 'Object',
        x,
        y,
        width: Math.max(...xs) - x,
        height: Math.max(...ys) - y,
      })
    })
}

export function importCustom(text: string): VideoRectObject[] {
  const parsed = JSON.parse(text)
  const list = Array.isArray(parsed) ? parsed : parsed.objects ?? parsed.annotations ?? []
  return list.map((o: Record<string, unknown>, i: number) =>
    rect({
      object_id: String(o.object_id ?? o.track_id ?? `Custom_${i + 1}`),
      label: String(o.label ?? o.class ?? 'Object'),
      frame: Number(o.frame ?? o.frame_index ?? 0),
      x: Number(o.x ?? o.xtl ?? 0),
      y: Number(o.y ?? o.ytl ?? 0),
      width: Number(o.width ?? o.w ?? (Number(o.xbr) - Number(o.xtl) || 10)),
      height: Number(o.height ?? o.h ?? (Number(o.ybr) - Number(o.ytl) || 10)),
    }),
  )
}

export function detectImportFormat(text: string): ImportFormat {
  const t = text.trim()
  if (t.startsWith('<?xml') || t.includes('<annotations')) return 'cvat'
  try {
    const j = JSON.parse(t)
    if (j.shapes && j.imagePath) return 'labelme'
    if (j.annotations && j.images && j.categories) return 'coco'
    if (j.version || j.rects) return 'json'
    return 'custom'
  } catch {
    if (/^\d+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+/m.test(t)) return 'yolo'
    if (/^\d+,\d+,/.test(t)) return 'mot'
    return 'custom'
  }
}
