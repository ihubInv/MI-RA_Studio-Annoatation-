import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { loadAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import type { AnnotationObjectPayload, SaveAnnotationPayload } from '@/services/annotations.service'
import { loadRgbDState } from '@/modules/video/rgbd/rgbdStore'
import { loadLidarState } from '@/modules/lidar/lidarStore'
import { loadCollab } from '@/modules/video/collab/collabStore'
import { loadReview } from '@/modules/video/review/reviewStore'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function maybeId(id: string | undefined): string | undefined {
  return id && UUID_RE.test(id) ? id : undefined
}

function obj(
  tool_type: string,
  class_name: string,
  geometry: Record<string, unknown>,
  extra: {
    id?: string
    frame?: number
    hidden?: boolean
    locked?: boolean
    attributes?: Record<string, unknown>
    comment?: string
  } = {},
): AnnotationObjectPayload {
  return {
    id: maybeId(extra.id),
    class_name: class_name || 'Object',
    tool_type,
    geometry,
    frame_index: extra.frame,
    is_keyframe: true,
    is_hidden: extra.hidden,
    is_locked: extra.locked,
    attributes: extra.attributes,
    comment: extra.comment,
  }
}

export function videoStoreToPayload(itemId: string, store: VideoAnnotationStore): SaveAnnotationPayload {
  const objects: AnnotationObjectPayload[] = []
  for (const r of store.rects) {
    objects.push(
      obj(r.tool_type, r.label, { x: r.x, y: r.y, w: r.width, h: r.height, rotation: r.rotation ?? 0, points: r.points }, {
        id: r.id,
        frame: r.frame,
        hidden: r.visible === false,
        locked: r.locked,
        attributes: { object_id: r.object_id, color: r.color, occlusion: r.occlusion, ...(r.attributes ?? {}) },
      }),
    )
  }
  for (const s of store.skeletons) {
    objects.push(
      obj('skeleton', s.label, { joints: s.joints, edges: s.edges, template_id: s.template_id }, {
        id: s.id,
        frame: s.frame,
        hidden: s.visible === false,
        locked: s.locked,
        attributes: { object_id: s.object_id, color: s.color, occlusion: s.occlusion, ...(s.attributes ?? {}) },
      }),
    )
  }
  for (const m of store.masks) {
    objects.push(
      obj(m.tool_type, m.label, { rle: m.rle, points: m.points, segmentation_mode: m.segmentation_mode }, {
        id: m.id,
        frame: m.frame,
        hidden: m.visible === false,
        locked: m.locked,
        attributes: { object_id: m.object_id, color: m.color, occlusion: m.occlusion, ...(m.attributes ?? {}) },
      }),
    )
  }
  for (const e of store.events) {
    objects.push(
      obj('event', e.label, { kind: e.kind, start_frame: e.frame, end_frame: e.end_frame ?? e.frame }, {
        id: e.id,
        frame: e.frame,
        attributes: { color: e.color, event_def_id: e.event_def_id, ...(e.attributes ?? {}) },
      }),
    )
  }
  for (const a of store.actions) {
    objects.push(
      obj('action', a.label, { start_frame: a.frame, end_frame: a.end_frame, actor_object_id: a.actor_object_id }, {
        id: a.id,
        frame: a.frame,
        attributes: { color: a.color, action_def_id: a.action_def_id, target_object_id: a.target_object_id, ...(a.attributes ?? {}) },
      }),
    )
  }
  for (const rel of store.relations) {
    objects.push(
      obj('relation', rel.label, { start_frame: rel.frame, end_frame: rel.end_frame }, {
        id: rel.id,
        frame: rel.frame,
        attributes: {
          color: rel.color,
          subject_object_id: rel.subject_object_id,
          object_object_id: rel.object_object_id,
          relation_def_id: rel.relation_def_id,
        },
      }),
    )
  }
  for (const sc of store.scenes) {
    objects.push(
      obj('scene', sc.label, { marker_kind: sc.marker_kind, start_frame: sc.frame, end_frame: sc.end_frame }, {
        id: sc.id,
        frame: sc.frame,
        attributes: { color: sc.color, scene_def_id: sc.scene_def_id, auto_detected: sc.auto_detected },
      }),
    )
  }

  const lidar = loadLidarState(itemId)
  const { cloud: _cloud, ...lidarMeta } = lidar

  return {
    item_id: itemId,
    objects,
    metadata: {
      video_bundle: store,
      rgbd: loadRgbDState(itemId),
      lidar: lidarMeta,
      collab: loadCollab(itemId),
      review: loadReview(itemId),
    },
  }
}

export function buildVideoSavePayload(itemId: string): SaveAnnotationPayload {
  return videoStoreToPayload(itemId, loadAnnotationStore(itemId))
}

export function isVideoBundle(
  meta: Record<string, unknown> | null | undefined,
): meta is {
  video_bundle: VideoAnnotationStore
  rgbd?: unknown
  lidar?: unknown
  collab?: unknown
  review?: unknown
} {
  return Boolean(meta && typeof meta === 'object' && meta.video_bundle && typeof meta.video_bundle === 'object')
}

export function objectsToVideoStore(objects: AnnotationObjectPayload[]): VideoAnnotationStore {
  const store: VideoAnnotationStore = {
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
  for (const o of objects) {
    const g = o.geometry || {}
    const attrs = o.attributes || {}
    const frame = o.frame_index ?? 0
    const label = o.class_name || 'Object'
    const object_id = String(attrs.object_id || label)
    const color = String(attrs.color || '#0d559e')
    const hidden = o.is_hidden
    const locked = o.is_locked
    if (o.tool_type === 'skeleton') {
      store.skeletons.push({
        id: o.id || crypto.randomUUID(),
        object_id,
        label,
        frame,
        tool_type: 'skeleton',
        template_id: String(g.template_id || ''),
        color,
        joints: (g.joints as never) || [],
        edges: (g.edges as never) || [],
        visible: !hidden,
        locked: Boolean(locked),
      })
      continue
    }
    if (o.tool_type === 'mask' || o.tool_type === 'brush') {
      if (!g.rle) continue
      store.masks.push({
        id: o.id || crypto.randomUUID(),
        object_id,
        label,
        frame,
        tool_type: o.tool_type as 'mask' | 'brush',
        color,
        rle: g.rle as never,
        points: g.points as never,
        segmentation_mode: (g.segmentation_mode as 'instance' | 'semantic') || 'instance',
        visible: !hidden,
        locked: Boolean(locked),
      })
      continue
    }
    if (['bbox', 'rectangle', 'ellipse', 'rotated_rect', 'polygon', 'polyline', 'point'].includes(o.tool_type)) {
      store.rects.push({
        id: o.id || crypto.randomUUID(),
        object_id,
        label,
        frame,
        tool_type: o.tool_type as never,
        x: Number(g.x ?? 0),
        y: Number(g.y ?? 0),
        width: Number(g.w ?? g.width ?? 0),
        height: Number(g.h ?? g.height ?? 0),
        rotation: Number(g.rotation ?? 0),
        points: g.points as never,
        color,
        visible: !hidden,
        locked: Boolean(locked),
      })
    }
  }
  return store
}
