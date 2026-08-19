import { useMemo, useRef, useState } from 'react'
import { BevView } from '@/modules/lidar/components/BevView'
import { PointCloudView } from '@/modules/lidar/components/PointCloudView'
import { generateDemoCloud, parseLidarFile } from '@/modules/lidar/lidarTypes'
import { downsample } from '@/modules/video/perf/downsample'
import type { useLidar } from '@/modules/video/hooks/useLidar'
import type { useRgbD } from '@/modules/video/hooks/useRgbD'
import type { useVideoReview } from '@/modules/video/hooks/useVideoReview'
import type { useVideoCollab } from '@/modules/video/hooks/useVideoCollab'
import type { useAnnotationVersions } from '@/modules/video/hooks/useAnnotationVersions'
import type { useVideoCloudSync } from '@/modules/video/hooks/useVideoCloudSync'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import { loadAnnotationStore, saveAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { runAllQa, qaSummary } from '@/modules/video/qa/validateAnnotations'
import { canReview } from '@/modules/video/review/reviewStore'
import {
  downloadText,
  exportCoco,
  exportCsv,
  exportCvat,
  exportKeypoints,
  exportKitti,
  exportLabelStudio,
  exportMot,
  exportNativeJson,
  exportNuScenes,
  exportSrt,
  exportVtt,
  exportWaymo,
  exportYolo,
} from '@/modules/video/io/exportFormats'
import { detectImportFormat, importCoco, importCvat, importCustom, importLabelMe, importMot, importNativeJson, importYolo } from '@/modules/video/io/importFormats'
import { downloadDatasetZip } from '@/modules/video/io/packageExport'
import { DEFAULT_OVERLAYS, renderAnnotatedClip, type OverlayOptions } from '@/modules/video/io/renderAnnotatedVideo'
import { hasPermission } from '@/modules/video/security/videoPermissions'
import type { VideoTrajectory } from '@/modules/video/trajectory/trajectoryTypes'
import { videoService } from '@/modules/video/api/video.service'
import { qaService, reviewsService } from '@/services/studioOps.service'
import { cn } from '@/utils/cn'

type Tab = 'rgbd' | 'lidar' | 'qa' | 'review' | 'collab' | 'versions' | 'io'

interface Props {
  itemId: string
  filename: string
  width: number
  height: number
  fps: number
  frameCount: number
  currentFrame: number
  role: string
  username: string
  selected: VideoRectObject | null
  rgbD: ReturnType<typeof useRgbD>
  lidar: ReturnType<typeof useLidar>
  review: ReturnType<typeof useVideoReview>
  collab: ReturnType<typeof useVideoCollab>
  versions: ReturnType<typeof useAnnotationVersions>
  videoEl: HTMLVideoElement | null
  trajectories: VideoTrajectory[]
  onImportedRects: (rects: VideoRectObject[]) => void
  cloudSync?: ReturnType<typeof useVideoCloudSync>
  datasetId?: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'rgbd', label: 'RGB-D' },
  { id: 'lidar', label: 'LiDAR' },
  { id: 'qa', label: 'QA' },
  { id: 'review', label: 'Review' },
  { id: 'collab', label: 'Collab' },
  { id: 'versions', label: 'Versions' },
  { id: 'io', label: 'I/O' },
]

export function VideoOpsPanel(props: Props) {
  const [tab, setTab] = useState<Tab>('qa')
  return (
    <div className="border-t border-border shrink-0 max-h-64 overflow-hidden flex flex-col">
      <div className="flex overflow-x-auto border-b bg-muted/30">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn('px-2 py-1.5 text-2xs shrink-0', tab === t.id ? 'font-semibold border-b-2 border-primary' : 'text-muted-foreground')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-y-auto p-2 text-xs space-y-2">
        {tab === 'rgbd' && <RgbDTab {...props} />}
        {tab === 'lidar' && <LidarTab {...props} />}
        {tab === 'qa' && <QaTab {...props} />}
        {tab === 'review' && <ReviewTab {...props} />}
        {tab === 'collab' && <CollabTab {...props} />}
        {tab === 'versions' && <VersionsTab {...props} />}
        {tab === 'io' && <IoTab {...props} />}
      </div>
    </div>
  )
}

function RgbDTab({ rgbD, selected, currentFrame, fps }: Props) {
  const s = rgbD.state
  return (
    <>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={s.enabled} onChange={(e) => rgbD.patch({ enabled: e.target.checked })} />
        Depth visualization
      </label>
      <label className="block text-2xs text-muted-foreground">
        Depth video URL
        <input
          className="mira-input h-7 text-2xs mt-0.5 w-full"
          value={s.depth.depth_video_url ?? ''}
          placeholder="Same-length depth MP4 (optional)"
          onChange={(e) => rgbD.patch({ depth: { ...s.depth, depth_video_url: e.target.value || undefined } })}
        />
      </label>
      <div className="grid grid-cols-2 gap-1">
        <label className="text-2xs">
          Colormap
          <select
            className="mira-input h-7 text-2xs w-full"
            value={s.colormap}
            onChange={(e) => rgbD.patch({ colormap: e.target.value as typeof s.colormap })}
          >
            <option value="turbo">Turbo</option>
            <option value="viridis">Viridis</option>
            <option value="gray">Gray</option>
          </select>
        </label>
        <label className="text-2xs">
          Sync offset (frames)
          <input
            type="number"
            className="mira-input h-7 text-2xs w-full font-mono"
            value={s.depth.offset_frames}
            onChange={(e) => rgbD.patch({ depth: { ...s.depth, offset_frames: Number(e.target.value) || 0 } })}
          />
        </label>
      </div>
      <button
        type="button"
        className="mira-btn-ghost h-7 text-2xs w-full"
        disabled={!selected}
        onClick={() => selected && rgbD.cuboidFromSelected(selected, 8)}
      >
        3D box from 2D bbox (f{currentFrame + 1})
      </button>
      <button
        type="button"
        className="mira-btn-ghost h-7 text-2xs w-full"
        disabled={!selected}
        onClick={() => selected && rgbD.generate3dTraj(selected.object_id, fps)}
      >
        Generate 3D trajectory
      </button>
      <p className="text-2xs text-muted-foreground">
        {s.cuboids.length} cuboid(s) · {s.trajectories3d.length} 3D path(s)
      </p>
    </>
  )
}

function LidarTab({ lidar }: Props) {
  const s = lidar.state
  return (
    <>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={s.enabled} onChange={(e) => lidar.patch({ enabled: e.target.checked })} />
        Project LiDAR on RGB
      </label>
      <label className="text-2xs">
        RGB offset frames
        <input
          type="number"
          className="mira-input h-7 text-2xs w-full font-mono"
          value={s.rgbOffsetFrames}
          onChange={(e) => lidar.patch({ rgbOffsetFrames: Number(e.target.value) || 0 })}
        />
      </label>
      <button type="button" className="mira-btn-ghost h-7 text-2xs w-full" onClick={() => lidar.patch({ cloud: generateDemoCloud(800, Date.now() % 9999) })}>
        Demo point cloud
      </button>
      <label className="mira-btn-ghost h-7 text-2xs w-full flex items-center justify-center cursor-pointer">
        Import PCD / PLY / XYZ
        <input
          type="file"
          accept=".pcd,.ply,.csv,.txt,.xyz"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              lidar.patch({ cloud: await parseLidarFile(file), enabled: true, showCloud: true })
            } catch (err) {
              window.alert(err instanceof Error ? err.message : 'Failed to parse point cloud')
            }
          }}
        />
      </label>
      {s.showCloud && (
        <PointCloudView points={s.cloud} cuboids={s.showCuboids ? s.cuboids : []} selectedIndex={s.selectedPointIndex} height={200} />
      )}
      <BevView
        points={downsample(s.cloud, 4000)}
        cuboids={s.cuboids}
        selectedIndex={s.selectedPointIndex}
        segmented={s.segmentedIndices}
        onSelectPoint={(i) => lidar.patch({ selectedPointIndex: i })}
        onToggleSegment={lidar.toggleSegment}
      />
      <p className="text-2xs text-muted-foreground">
        Shift-click points to segment · {s.cloud.length} pts · {s.segmentedIndices.length} selected
      </p>
      <button
        type="button"
        className="mira-btn-ghost h-7 text-2xs w-full"
        onClick={() =>
          lidar.patch({
            cuboids: [
              ...s.cuboids,
              {
                id: crypto.randomUUID(),
                object_id: `Lidar_${String(s.cuboids.length + 1).padStart(3, '0')}`,
                label: 'Object',
                color: '#f97316',
                x: 0,
                y: 0,
                z: 10,
                l: 4,
                w: 2,
                h: 1.6,
                yaw: 0,
              },
            ],
          })
        }
      >
        Add 3D cuboid (BEV)
      </button>
    </>
  )
}

function QaTab({ itemId, fps, cloudSync }: Props) {
  const store = loadAnnotationStore(itemId)
  const issues = useMemo(() => runAllQa(store, fps), [itemId, fps, store.rects.length, store.masks.length])
  const sum = qaSummary(issues)
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <p className="text-2xs">
        <span className="text-destructive font-medium">{sum.errors} errors</span>
        {' · '}
        {sum.warnings} warnings
      </p>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          className="mira-btn-ghost h-7 text-2xs"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await cloudSync?.flushNow()
              const r = await qaService.run(itemId, fps)
              setServerMsg(`Server QA score ${(r.score * 100).toFixed(0)}% · ${r.errors} errors`)
            } catch (err) {
              setServerMsg(err instanceof Error ? err.message : 'Server QA failed')
            } finally {
              setBusy(false)
            }
          }}
        >
          Run on server
        </button>
        <button
          type="button"
          className="mira-btn-ghost h-7 text-2xs"
          disabled={busy || !cloudSync?.annotationId}
          onClick={async () => {
            if (!cloudSync?.annotationId) return
            setBusy(true)
            try {
              await qaService.markGold(itemId, cloudSync.annotationId)
              setServerMsg('Marked as gold sample')
            } catch (err) {
              setServerMsg(err instanceof Error ? err.message : 'Gold mark failed')
            } finally {
              setBusy(false)
            }
          }}
        >
          Mark gold
        </button>
        <button
          type="button"
          className="mira-btn-ghost h-7 text-2xs col-span-2"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await cloudSync?.flushNow()
              const r = await qaService.consensus(itemId)
              setServerMsg(`Consensus merged ${r.merged_objects} objects from ${r.annotators} annotators`)
            } catch (err) {
              setServerMsg(err instanceof Error ? err.message : 'Consensus failed')
            } finally {
              setBusy(false)
            }
          }}
        >
          Merge consensus
        </button>
      </div>
      {serverMsg && <p className="text-2xs text-muted-foreground">{serverMsg}</p>}
      <ul className="space-y-1 max-h-36 overflow-y-auto">
        {issues.slice(0, 40).map((i) => (
          <li key={i.id + i.message} className="text-2xs border-b border-border/40 pb-1">
            <span className={i.severity === 'error' ? 'text-destructive' : 'text-amber-700'}>{i.code}</span> {i.message}
          </li>
        ))}
        {!issues.length && <li className="text-muted-foreground text-2xs">No QA issues.</li>}
      </ul>
    </>
  )
}

function ReviewTab({ review, role, cloudSync }: Props) {
  const reviewer = canReview(role)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <>
      <p className="capitalize font-medium">{review.review.status.replace('_', ' ')}</p>
      <p className="text-2xs text-muted-foreground">
        Annotator → Submit → Reviewer → Approve / Reject (saved on the server)
      </p>
      {review.review.status === 'draft' || review.review.status === 'rejected' ? (
        <button
          type="button"
          className="mira-btn-primary h-8 text-xs w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const saved = await cloudSync?.submit()
              if (saved?.id) await reviewsService.create(saved.id, review.review.note)
              review.submit()
              setMsg('Submitted to server')
            } catch (err) {
              review.submit()
              setMsg(err instanceof Error ? err.message : 'Local submit only')
            } finally {
              setBusy(false)
            }
          }}
        >
          Submit for review
        </button>
      ) : null}
      {reviewer && (review.review.status === 'submitted' || review.review.status === 'in_review') && (
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            className="mira-btn-primary h-8 text-xs"
            onClick={async () => {
              try {
                const list = await reviewsService.list()
                const open = list.items.find((r) => r.status === 'in_review' || r.status === 'submitted')
                if (open) await reviewsService.approve(open.id)
              } catch {
                /* local fallback */
              }
              review.decide('approve')
            }}
          >
            Approve
          </button>
          <button
            type="button"
            className="mira-btn-ghost h-8 text-xs text-destructive"
            onClick={async () => {
              try {
                const list = await reviewsService.list()
                const open = list.items.find((r) => r.status === 'in_review' || r.status === 'submitted')
                if (open) await reviewsService.reject(open.id)
              } catch {
                /* local fallback */
              }
              review.decide('reject')
            }}
          >
            Reject
          </button>
        </div>
      )}
      {msg && <p className="text-2xs text-muted-foreground">{msg}</p>}
      <textarea
        className="mira-input text-2xs w-full min-h-[48px]"
        placeholder="Review note"
        value={review.review.note ?? ''}
        onChange={(e) => review.setReview({ ...review.review, note: e.target.value })}
      />
    </>
  )
}

function CollabTab({ collab, currentFrame }: Props) {
  const [text, setText] = useState('')
  const [assignee, setAssignee] = useState('')
  return (
    <>
      <button type="button" className="mira-btn-ghost h-7 text-2xs w-full" onClick={collab.toggleLock}>
        {collab.state.lock.locked ? `Unlock (${collab.state.lock.locked_by})` : 'Lock item'}
      </button>
      <div className="flex gap-1">
        <input className="mira-input h-7 text-2xs flex-1" placeholder="Assign user" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        <button
          type="button"
          className="mira-btn-ghost h-7 text-2xs"
          onClick={() => {
            if (assignee.trim()) collab.assign(assignee.trim())
            setAssignee('')
          }}
        >
          Assign
        </button>
      </div>
      <p className="text-2xs text-muted-foreground">Assignees: {collab.state.assignees.join(', ') || '—'}</p>
      <textarea className="mira-input text-2xs w-full" rows={2} placeholder="Comment… use @user" value={text} onChange={(e) => setText(e.target.value)} />
      <button
        type="button"
        className="mira-btn-ghost h-7 text-2xs w-full"
        onClick={() => {
          if (!text.trim()) return
          collab.addComment(text.trim(), currentFrame)
          setText('')
        }}
      >
        Add comment
      </button>
      <ul className="max-h-24 overflow-y-auto space-y-1">
        {collab.state.comments.slice(-8).reverse().map((c) => (
          <li key={c.id} className="text-2xs">
            <span className="font-medium">{c.author}</span>
            {c.frame != null ? ` · f${c.frame + 1}` : ''}: {c.text}
          </li>
        ))}
      </ul>
      <p className="text-2xs text-muted-foreground">{collab.state.activity.length} activity event(s)</p>
    </>
  )
}

function VersionsTab({ versions, itemId, username }: Props) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const diff = a && b ? versions.diff(a, b) : null
  return (
    <>
      <button
        type="button"
        className="mira-btn-ghost h-7 text-2xs w-full"
        onClick={() => versions.snapshot(loadAnnotationStore(itemId), `v${versions.versions.length + 1}`)}
      >
        Snapshot current ({username})
      </button>
      <p className="text-2xs font-mono">{versions.versions.map((v) => `v${v.version}`).join(' → ') || 'No versions yet'}</p>
      <ul className="max-h-24 overflow-y-auto space-y-1">
        {versions.versions.slice().reverse().map((v) => (
          <li key={v.id} className="flex justify-between gap-1 text-2xs">
            <span>
              v{v.version} · {new Date(v.created_at).toLocaleString()}
            </span>
            <button
              type="button"
              className="text-primary"
              onClick={() => {
                const snap = versions.restore(v.id)
                if (snap) saveAnnotationStore(itemId, snap.snapshot)
                window.location.reload()
              }}
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
      {versions.versions.length >= 2 && (
        <div className="grid grid-cols-2 gap-1">
          <select className="mira-input h-7 text-2xs" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">Compare A</option>
            {versions.versions.map((v) => (
              <option key={v.id} value={v.id}>v{v.version}</option>
            ))}
          </select>
          <select className="mira-input h-7 text-2xs" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">Compare B</option>
            {versions.versions.map((v) => (
              <option key={v.id} value={v.id}>v{v.version}</option>
            ))}
          </select>
        </div>
      )}
      {diff && <p className="text-2xs font-mono">Δ rects {diff.rects} · masks {diff.masks} · events {diff.events}</p>}
    </>
  )
}

function IoTab({ itemId, filename, width, height, fps, frameCount, videoEl, trajectories, onImportedRects, role, datasetId }: Props) {
  const [overlays, setOverlays] = useState<OverlayOptions>(DEFAULT_OVERLAYS)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const seqRef = useRef<HTMLInputElement>(null)
  const store = loadAnnotationStore(itemId)
  const allowExport = hasPermission(role, 'export')

  const runExport = (kind: string) => {
    if (!allowExport) return
    if (kind === 'json') downloadText(`${itemId}.json`, exportNativeJson(store, itemId), 'application/json')
    if (kind === 'csv') downloadText(`${itemId}.csv`, exportCsv(store), 'text/csv')
    if (kind === 'mot') downloadText(`${itemId}.txt`, exportMot(store))
    if (kind === 'cvat') downloadText(`${itemId}.xml`, exportCvat(store, itemId), 'application/xml')
    if (kind === 'coco') downloadText(`${itemId}-coco.json`, JSON.stringify(exportCoco(store, itemId, width, height), null, 2), 'application/json')
    if (kind === 'yolo') {
      const y = exportYolo(store, width, height)
      downloadText('classes.txt', y.classes)
      downloadText('labels-frame0.txt', y.frames[0] ?? '')
    }
    if (kind === 'keypoints') downloadText(`${itemId}-kpts.json`, exportKeypoints(store), 'application/json')
    if (kind === 'srt') downloadText(`${itemId}.srt`, exportSrt(store, fps))
    if (kind === 'vtt') downloadText(`${itemId}.vtt`, exportVtt(store, fps), 'text/vtt')
    if (kind === 'kitti') downloadText(`${itemId}-kitti.txt`, exportKitti(store))
    if (kind === 'label_studio') downloadText(`${itemId}-label-studio.json`, exportLabelStudio(store, itemId, width, height, fps), 'application/json')
    if (kind === 'nuscenes') downloadText(`${itemId}-nuscenes.json`, exportNuScenes(store, itemId), 'application/json')
    if (kind === 'waymo') downloadText(`${itemId}-waymo.json`, exportWaymo(store, itemId), 'application/json')
    if (kind === 'package') void downloadDatasetZip(store, { itemId, filename, width, height, fps, frameCount })
  }

  return (
    <>
      <p className="text-2xs font-medium">Cloud / sequence import</p>
      <div className="flex gap-1">
        <input className="mira-input h-7 text-2xs flex-1" placeholder="https://…/video.mp4" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          type="button"
          className="mira-btn-ghost h-7 text-2xs"
          disabled={!datasetId || !url.trim() || busy}
          onClick={async () => {
            if (!datasetId) return
            setBusy(true)
            try {
              const r = await videoService.importUrl(datasetId, url.trim())
              setProgress(`Imported ${r.filename}`)
            } catch (err) {
              setProgress(err instanceof Error ? err.message : 'URL import failed')
            } finally {
              setBusy(false)
            }
          }}
        >
          Fetch URL
        </button>
      </div>
      <label className="mira-btn-ghost h-7 text-2xs w-full flex items-center justify-center cursor-pointer">
        Image sequence → MP4
        <input
          ref={seqRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            if (!datasetId || !e.target.files?.length) return
            setBusy(true)
            try {
              const r = await videoService.importSequence(datasetId, [...e.target.files], fps)
              setProgress(`Sequence ingested (${r.frames} frames)`)
            } catch (err) {
              setProgress(err instanceof Error ? err.message : 'Sequence import failed')
            } finally {
              setBusy(false)
            }
          }}
        />
      </label>
      <p className="text-2xs font-medium">Import labels</p>
      <input
        ref={fileRef}
        type="file"
        className="text-2xs w-full"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const text = await file.text()
          const fmt = detectImportFormat(text)
          let rects: VideoRectObject[] = []
          if (fmt === 'json') {
            const s = importNativeJson(text)
            saveAnnotationStore(itemId, s)
            window.location.reload()
            return
          }
          if (fmt === 'yolo') rects = importYolo(text, width, height, ['Object'])
          else if (fmt === 'coco') rects = importCoco(text)
          else if (fmt === 'mot') rects = importMot(text)
          else if (fmt === 'cvat') rects = importCvat(text)
          else if (fmt === 'labelme') rects = importLabelMe(text)
          else rects = importCustom(text)
          onImportedRects(rects)
        }}
      />
      <p className="text-2xs font-medium pt-1">Export</p>
      <div className="grid grid-cols-3 gap-1">
        {['json', 'csv', 'yolo', 'coco', 'mot', 'cvat', 'kitti', 'label_studio', 'nuscenes', 'waymo', 'keypoints', 'srt', 'package'].map((k) => (
          <button key={k} type="button" className="mira-btn-ghost h-7 text-2xs capitalize" onClick={() => runExport(k)}>
            {k.replace('_', ' ')}
          </button>
        ))}
      </div>
      <p className="text-2xs font-medium pt-1">Annotated video</p>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {(Object.keys(overlays) as (keyof OverlayOptions)[]).map((k) => (
          <label key={k} className="text-2xs flex items-center gap-0.5">
            <input type="checkbox" checked={overlays[k]} onChange={(e) => setOverlays({ ...overlays, [k]: e.target.checked })} />
            {k}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="mira-btn-primary h-7 text-2xs w-full"
        disabled={busy || !videoEl}
        onClick={async () => {
          if (!videoEl) return
          setBusy(true)
          setProgress('Recording full video…')
          try {
            const { blob, ext } = await renderAnnotatedClip(videoEl, store, trajectories, overlays, fps, {
              onProgress: (p) => setProgress(`Recording ${(p * 100).toFixed(0)}%`),
            })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `${itemId}-annotated.${ext}`
            a.click()
            URL.revokeObjectURL(a.href)
            setProgress(`Downloaded annotated.${ext}`)
          } catch (err) {
            setProgress(err instanceof Error ? err.message : 'Render failed')
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? progress || 'Rendering…' : 'Export full annotated video'}
      </button>
      <button
        type="button"
        className="mira-btn-ghost h-7 text-2xs w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const r = await videoService.renderAnnotated(itemId)
            window.open(r.url, '_blank')
            setProgress('Server MP4 ready')
          } catch (err) {
            setProgress(err instanceof Error ? err.message : 'Server render failed (local attach uses the button above)')
          } finally {
            setBusy(false)
          }
        }}
      >
        Server FFmpeg MP4
      </button>
      {progress && <p className="text-2xs text-muted-foreground">{progress}</p>}
    </>
  )
}
