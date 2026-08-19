import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'

export type ExportFormat =
  | 'json'
  | 'csv'
  | 'yolo'
  | 'coco'
  | 'mot'
  | 'cvat'
  | 'srt'
  | 'vtt'
  | 'keypoints'
  | 'kitti'
  | 'label_studio'
  | 'nuscenes'
  | 'waymo'

export function exportNativeJson(store: VideoAnnotationStore, itemId: string) {
  return JSON.stringify({ item_id: itemId, format: 'mira.video', ...store }, null, 2)
}

export function exportCsv(store: VideoAnnotationStore) {
  const rows = ['object_id,label,frame,x,y,width,height,color']
  for (const r of store.rects) {
    rows.push([r.object_id, r.label, r.frame, r.x, r.y, r.width, r.height, r.color].join(','))
  }
  return rows.join('\n')
}

export function exportYolo(store: VideoAnnotationStore, imgW: number, imgH: number) {
  const w = Math.max(imgW, 1)
  const h = Math.max(imgH, 1)
  const labels = [...new Set(store.rects.map((r) => r.label))]
  const byFrame = new Map<number, string[]>()
  for (const r of store.rects) {
    const cls = labels.indexOf(r.label)
    const xc = (r.x + r.width / 2) / w
    const yc = (r.y + r.height / 2) / h
    const nw = r.width / w
    const nh = r.height / h
    const line = `${cls} ${xc.toFixed(6)} ${yc.toFixed(6)} ${nw.toFixed(6)} ${nh.toFixed(6)}`
    const list = byFrame.get(r.frame) ?? []
    list.push(line)
    byFrame.set(r.frame, list)
  }
  return { classes: labels.join('\n'), frames: Object.fromEntries([...byFrame].map(([f, lines]) => [f, lines.join('\n')])) }
}

export function exportCoco(store: VideoAnnotationStore, itemId: string, width: number, height: number) {
  const cats = [...new Set(store.rects.map((r) => r.label))].map((name, i) => ({ id: i + 1, name }))
  const catId = (name: string) => cats.find((c) => c.name === name)?.id ?? 1
  return {
    info: { description: 'MI-RA video COCO export', year: new Date().getFullYear() },
    images: [{ id: 1, file_name: itemId, width, height }],
    categories: cats,
    annotations: store.rects.map((r, i) => ({
      id: i + 1,
      image_id: 1,
      category_id: catId(r.label),
      bbox: [r.x, r.y, r.width, r.height],
      area: r.width * r.height,
      iscrowd: 0,
      attributes: { frame: r.frame, object_id: r.object_id },
    })),
  }
}

export function exportMot(store: VideoAnnotationStore) {
  const lines: string[] = []
  const ids = [...new Set(store.rects.map((r) => r.object_id))]
  for (const r of store.rects) {
    const tid = ids.indexOf(r.object_id) + 1
    lines.push(`${r.frame + 1},${tid},${r.x.toFixed(2)},${r.y.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)},1,-1,-1,-1`)
  }
  return lines.join('\n')
}

export function exportCvat(store: VideoAnnotationStore, itemId: string) {
  const tracks = new Map<string, typeof store.rects>()
  for (const r of store.rects) {
    const list = tracks.get(r.object_id) ?? []
    list.push(r)
    tracks.set(r.object_id, list)
  }
  const body = [...tracks.entries()]
    .map(([oid, boxes], i) => {
      const boxesXml = boxes
        .map(
          (b) =>
            `    <box frame="${b.frame}" xtl="${b.x}" ytl="${b.y}" xbr="${b.x + b.width}" ybr="${b.y + b.height}" outside="0" occluded="0"/>`,
        )
        .join('\n')
      return `  <track id="${i}" label="${boxes[0]?.label ?? oid}">\n${boxesXml}\n  </track>`
    })
    .join('\n')
  return `<?xml version="1.0"?>\n<annotations>\n  <meta><task><name>${itemId}</name></task></meta>\n${body}\n</annotations>\n`
}

function srtTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function exportSrt(store: VideoAnnotationStore, fps: number) {
  return store.events
    .map((ev, i) => {
      const start = ev.frame / Math.max(fps, 1)
      const end = (ev.end_frame ?? ev.frame + Math.round(fps / 2)) / Math.max(fps, 1)
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${ev.label}\n`
    })
    .join('\n')
}

export function exportVtt(store: VideoAnnotationStore, fps: number) {
  const srt = exportSrt(store, fps).replace(/,/g, '.')
  return `WEBVTT\n\n${srt}`
}

export function exportKeypoints(store: VideoAnnotationStore) {
  return JSON.stringify(
    store.skeletons.map((s) => ({
      object_id: s.object_id,
      frame: s.frame,
      label: s.label,
      keypoints: s.joints,
    })),
    null,
    2,
  )
}

/** KITTI tracking (frame, track_id, type, truncated, occluded, alpha, bbox, dims, loc, ry). */
export function exportKitti(store: VideoAnnotationStore) {
  const ids = [...new Set(store.rects.map((r) => r.object_id))]
  return store.rects
    .map((r) => {
      const tid = ids.indexOf(r.object_id)
      const occ = r.occlusion === 'fully_occluded' ? 2 : r.occlusion === 'partially_occluded' ? 1 : 0
      const type = (r.label || 'DontCare').replace(/\s+/g, '')
      return [
        r.frame,
        tid,
        type,
        0,
        occ,
        -10,
        r.x.toFixed(2),
        r.y.toFixed(2),
        (r.x + r.width).toFixed(2),
        (r.y + r.height).toFixed(2),
        -1,
        -1,
        -1,
        -1000,
        -1000,
        -1000,
        ((r.rotation ?? 0) * Math.PI) / 180,
      ].join(' ')
    })
    .join('\n')
}

export function exportLabelStudio(store: VideoAnnotationStore, itemId: string, width: number, height: number, fps: number) {
  const results = store.rects.map((r) => ({
    from_name: 'box',
    to_name: 'video',
    type: 'videorectangle',
    value: {
      x: (r.x / Math.max(width, 1)) * 100,
      y: (r.y / Math.max(height, 1)) * 100,
      width: (r.width / Math.max(width, 1)) * 100,
      height: (r.height / Math.max(height, 1)) * 100,
      rotation: r.rotation ?? 0,
      rectanglelabels: [r.label],
      sequence: [{ frame: r.frame + 1, enabled: true, rotation: r.rotation ?? 0, x: (r.x / Math.max(width, 1)) * 100, y: (r.y / Math.max(height, 1)) * 100, width: (r.width / Math.max(width, 1)) * 100, height: (r.height / Math.max(height, 1)) * 100 }],
    },
    meta: { object_id: r.object_id, tool_type: r.tool_type },
  }))
  return JSON.stringify(
    [{ data: { video: itemId, fps }, annotations: [{ result: results }] }],
    null,
    2,
  )
}

/** nuScenes-style sample annotations subset (boxes in image plane + tracking id). */
export function exportNuScenes(store: VideoAnnotationStore, itemId: string) {
  const ids = [...new Set(store.rects.map((r) => r.object_id))]
  return JSON.stringify(
    {
      format: 'nuscenes-lite',
      sample_token: itemId,
      sample_annotations: store.rects.map((r, i) => ({
        token: r.id,
        sample_token: itemId,
        instance_token: r.object_id,
        category_name: r.label,
        translation: [r.x + r.width / 2, r.y + r.height / 2, 0],
        size: [r.width, r.height, 1],
        rotation: [0, 0, 0, 1],
        visibility_token: r.occlusion === 'fully_occluded' ? '1' : '4',
        attribute_tokens: [],
        num_lidar_pts: 0,
        num_radar_pts: 0,
        next: '',
        prev: '',
        tracking_id: ids.indexOf(r.object_id) + 1,
        frame_index: r.frame,
        annotation_index: i,
      })),
    },
    null,
    2,
  )
}

/** Waymo Open Dataset-like label JSON subset. */
export function exportWaymo(store: VideoAnnotationStore, itemId: string) {
  const byFrame = new Map<number, typeof store.rects>()
  for (const r of store.rects) {
    const list = byFrame.get(r.frame) ?? []
    list.push(r)
    byFrame.set(r.frame, list)
  }
  return JSON.stringify(
    {
      format: 'waymo-lite',
      context_name: itemId,
      frames: [...byFrame.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([frame, boxes]) => ({
          timestamp_micros: frame,
          labels: boxes.map((r) => ({
            id: r.object_id,
            type: r.label,
            box: { center_x: r.x + r.width / 2, center_y: r.y + r.height / 2, width: r.width, length: r.height, heading: ((r.rotation ?? 0) * Math.PI) / 180 },
          })),
        })),
    },
    null,
    2,
  )
}

export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
