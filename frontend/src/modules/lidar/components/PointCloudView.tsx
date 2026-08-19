import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { LidarCuboid, LidarPoint } from '@/modules/lidar/lidarTypes'

interface Props {
  points: LidarPoint[]
  cuboids?: LidarCuboid[]
  selectedIndex?: number | null
  height?: number
}

const MAX_POINTS = 80_000

export function PointCloudView({ points, cuboids = [], selectedIndex = null, height = 240 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const width = host.clientWidth || 320
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b1220)
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000)
    camera.position.set(0, 20, 40)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.replaceChildren(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    const sample = points.length > MAX_POINTS ? points.filter((_, i) => i % Math.ceil(points.length / MAX_POINTS) === 0) : points
    const positions = new Float32Array(sample.length * 3)
    const colors = new Float32Array(sample.length * 3)
    const color = new THREE.Color()
    sample.forEach((p, i) => {
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      const t = p.intensity ?? (p.z % 20) / 20
      color.setHSL(0.6 - t * 0.5, 0.75, 0.55)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    })
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geom.computeBoundingSphere()
    const cloud = new THREE.Points(
      geom,
      new THREE.PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true }),
    )
    scene.add(cloud)

    if (selectedIndex != null && points[selectedIndex]) {
      const p = points[selectedIndex]
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xf97316 }))
      marker.position.set(p.x, p.y, p.z)
      scene.add(marker)
    }

    for (const c of cuboids) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(c.l, c.h, c.w),
        new THREE.MeshBasicMaterial({ color: c.color, wireframe: true }),
      )
      box.position.set(c.x, c.y, c.z)
      box.rotation.y = c.yaw
      scene.add(box)
    }

    scene.add(new THREE.AxesHelper(5))
    scene.add(new THREE.GridHelper(40, 20, 0x334155, 0x1e293b))

    let raf = 0
    const tick = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      controls.dispose()
      geom.dispose()
      renderer.dispose()
      host.replaceChildren()
    }
  }, [points, cuboids, selectedIndex, height])

  return <div ref={hostRef} className="w-full rounded border border-border overflow-hidden bg-slate-950" style={{ height }} />
}
