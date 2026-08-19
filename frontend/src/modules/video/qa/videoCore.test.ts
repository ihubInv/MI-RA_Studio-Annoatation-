import { describe, expect, it } from 'vitest'
import { interpolatePolygon, interpolateRect, lerp, lerpAngleDeg, resolveDisplayObjects } from '@/modules/video/canvas/interpolation'
import { screenToVideo, videoToScreen } from '@/modules/video/canvas/coords'
import { buildVideoTracks } from '@/modules/video/timeline/trackOps'
import { aabbFromPoints, hitTestShape, type VideoRectObject } from '@/modules/video/canvas/types'
import { isInvalidGeometry, validateAnnotations, validateConfidence, validateTemporal } from '@/modules/video/qa/validateAnnotations'
import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { exportKitti, exportMot, exportYolo } from '@/modules/video/io/exportFormats'
import { objectsToVideoStore, videoStoreToPayload } from '@/modules/video/io/serverSync'
import { parsePcd, parsePly } from '@/modules/lidar/lidarTypes'
import { importMot, importYolo } from '@/modules/video/io/importFormats'
import { projectPoint } from '@/modules/video/rgbd/project3d'
import { downsample } from '@/modules/video/perf/downsample'

function rect(p: Partial<VideoRectObject> & Pick<VideoRectObject, 'object_id' | 'frame' | 'x' | 'y' | 'width' | 'height'>): VideoRectObject {
  return {
    id: p.id ?? crypto.randomUUID(),
    label: p.label ?? 'Person',
    tool_type: 'bbox',
    color: '#fff',
    ...p,
  }
}

const emptyStore = (rects: VideoRectObject[]): VideoAnnotationStore => ({
  version: 7,
  rects,
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
})

describe('interpolation', () => {
  it('lerps linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
  it('interpolates rects', () => {
    const g = interpolateRect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 }, 0, 10, 5)
    expect(g.x).toBe(5)
  })
  it('lerps angles the short way', () => {
    expect(lerpAngleDeg(350, 10, 0.5)).toBeCloseTo(0, 5)
  })
})

describe('coords', () => {
  it('round-trips screen and video', () => {
    const v = screenToVideo(110, 210, { left: 10, top: 10 } as DOMRect, { x: 0, y: 0 }, 2)
    expect(v).toEqual({ x: 50, y: 100 })
    const s = videoToScreen(50, 100, { x: 0, y: 0 }, 2)
    expect(s).toEqual({ x: 100, y: 200 })
  })
})

describe('tracks', () => {
  it('builds a track from keyframes', () => {
    const tracks = buildVideoTracks([
      rect({ object_id: 'A', frame: 0, x: 0, y: 0, width: 10, height: 10 }),
      rect({ object_id: 'A', frame: 5, x: 5, y: 0, width: 10, height: 10 }),
    ])
    expect(tracks[0].start_frame).toBe(0)
    expect(tracks[0].end_frame).toBe(5)
    expect(tracks[0].keyframes).toEqual([0, 5])
  })
})

describe('QA', () => {
  it('detects missing labels and invalid geometry', () => {
    const store = emptyStore([
      rect({ object_id: 'A', label: '', frame: 0, x: 0, y: 0, width: 0, height: 10 }),
    ])
    const issues = validateAnnotations(store)
    expect(issues.some((i) => i.code === 'missing_label')).toBe(true)
    expect(issues.some((i) => i.code === 'invalid_geometry')).toBe(true)
    expect(isInvalidGeometry(store.rects[0])).toBe(true)
  })
  it('detects track gaps and jumps', () => {
    const store = emptyStore([
      rect({ object_id: 'A', frame: 0, x: 0, y: 0, width: 10, height: 10 }),
      rect({ object_id: 'A', frame: 80, x: 400, y: 0, width: 10, height: 10 }),
    ])
    const issues = validateTemporal(store, 30)
    expect(issues.some((i) => i.code === 'track_gap')).toBe(true)
  })
  it('flags low confidence', () => {
    const store = emptyStore([
      rect({ object_id: 'A', frame: 0, x: 0, y: 0, width: 10, height: 10, attributes: { confidence: 0.2 } }),
    ])
    expect(validateConfidence(store).some((i) => i.code === 'low_confidence')).toBe(true)
  })
})

describe('import/export roundtrip', () => {
  it('YOLO export then import', () => {
    const store = emptyStore([rect({ object_id: 'A', frame: 0, x: 25, y: 25, width: 50, height: 50 })])
    const y = exportYolo(store, 100, 100)
    const back = importYolo(y.frames[0], 100, 100, ['Person'])
    expect(back[0].width).toBeCloseTo(50, 4)
  })
  it('MOT export then import', () => {
    const store = emptyStore([rect({ object_id: 'A', frame: 2, x: 1, y: 2, width: 3, height: 4 })])
    const mot = exportMot(store)
    const back = importMot(mot)
    expect(back[0].frame).toBe(2)
    expect(back[0].width).toBe(3)
  })
})

describe('3d project + perf', () => {
  it('projects a point in front of camera', () => {
    const p = projectPoint(0, 0, 10, { fx: 500, fy: 500, cx: 320, cy: 240 })
    expect(p).toEqual({ x: 320, y: 240 })
  })
  it('downsamples long lists', () => {
    expect(downsample([1, 2, 3, 4, 5, 6], 3).length).toBe(3)
  })
})

describe('geometry tools', () => {
  it('hits a polygon interior and a point marker', () => {
    const poly: VideoRectObject = {
      ...rect({ object_id: 'P', frame: 0, x: 0, y: 0, width: 10, height: 10 }),
      tool_type: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    }
    expect(hitTestShape(5, 5, poly)).toBe('move')
    expect(hitTestShape(50, 50, poly)).toBeNull()
    const pt = { ...rect({ object_id: 'Q', frame: 0, x: 8, y: 8, width: 10, height: 10 }), tool_type: 'point' as const }
    expect(hitTestShape(13, 13, pt)).toBe('move')
    const box = aabbFromPoints([
      { x: 10, y: 20 },
      { x: 40, y: 80 },
    ])
    expect(box.x).toBe(10)
    expect(box.height).toBe(60)
  })
  it('interpolates polygon vertices', () => {
    const mid = interpolatePolygon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
      ],
      0.5,
    )
    expect(mid[0]).toEqual({ x: 5, y: 5 })
  })
})

describe('server mapper + lidar parsers + KITTI', () => {
  it('round-trips video store through save payload objects', () => {
    const store = emptyStore([
      rect({ object_id: 'A', frame: 3, x: 1, y: 2, width: 30, height: 40, tool_type: 'ellipse' }),
    ])
    const payload = videoStoreToPayload('00000000-0000-4000-8000-000000000001', store)
    const back = objectsToVideoStore(payload.objects)
    expect(back.rects[0].tool_type).toBe('ellipse')
    expect(back.rects[0].width).toBe(30)
    expect(back.rects[0].frame).toBe(3)
  })
  it('parses ASCII PCD and PLY', () => {
    const pcd = ['# .PCD', 'FIELDS x y z intensity', 'DATA ascii', '1 2 3 0.5', '4 5 6 0.1'].join('\n')
    expect(parsePcd(pcd)).toEqual([
      { x: 1, y: 2, z: 3, intensity: 0.5 },
      { x: 4, y: 5, z: 6, intensity: 0.1 },
    ])
    const ply = ['ply', 'format ascii 1.0', 'element vertex 1', 'property float x', 'property float y', 'property float z', 'end_header', '9 8 7'].join('\n')
    expect(parsePly(ply)[0]).toEqual({ x: 9, y: 8, z: 7, intensity: undefined })
  })
  it('exports KITTI tracking lines', () => {
    const line = exportKitti(emptyStore([rect({ object_id: 'A', frame: 4, x: 1, y: 2, width: 3, height: 4 })]))
    expect(line.startsWith('4 0 Person')).toBe(true)
  })
})

describe('long / 4K scale (synthetic, no media files)', () => {
  it('interpolates a 10-minute 30fps track (18k frames, 1 kf/sec)', () => {
    const rects: VideoRectObject[] = []
    for (let f = 0; f <= 18_000; f += 30) {
      rects.push(rect({ object_id: 'A', frame: f, x: f / 10, y: 10, width: 80, height: 40 }))
    }
    const t0 = performance.now()
    const mid = resolveDisplayObjects(rects, 9015)
    expect(performance.now() - t0).toBeLessThan(100)
    expect(mid[0].interpolated).toBe(true)
    expect(mid[0].x).toBeCloseTo(901.5, 5)
  })
  it('interpolates a 1-hour track at 4K coordinates', () => {
    const rects: VideoRectObject[] = []
    for (let f = 0; f <= 108_000; f += 30) {
      const t = f / 108_000
      rects.push(rect({ object_id: 'Cam', frame: f, x: t * 3840, y: t * 2160, width: 120, height: 80 }))
    }
    const t0 = performance.now()
    const mid = resolveDisplayObjects(rects, 54_015)
    expect(performance.now() - t0).toBeLessThan(250)
    expect(mid[0].interpolated).toBe(true)
    expect(mid[0].x).toBeGreaterThan(1919)
    expect(mid[0].x).toBeLessThan(1922)
    expect(mid[0].y).toBeGreaterThan(1079)
    expect(mid[0].y).toBeLessThan(1082)
  })
})
