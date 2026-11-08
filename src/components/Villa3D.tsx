import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import rawSpatial from '../data/spatial-model.json'
import rawPlans from '../data/architectural-plans.json'
import furnitureVectors from '../data/furniture-vectors.json'

/**
 * Stage 3: generated from SOURCE PRINT GEOMETRY, not semantic/millimetre BIM.
 * Wall footprints are PDF-sourced; elevations, site position and floor masks are PRELIMINARY.
 */
type Ring = number[][]
type Polygon = { outer: Ring; holes: Ring[] }
type FloorSource = {
  sourceSheet: string
  sourceViewport: { xPt: number; yPt: number; widthPt: number; heightPt: number }
  wallPolygonsPt: Polygon[]
  slabEnvelopePt: Polygon[]
  wallPolygonCount: number
}
type SpatialModel = {
  calibration: { pointsPerMeter: number; confidence: string; approvedForConstruction: boolean }
  displayAssumptions: { wallHeightM: number; slabThicknessM: number; level3BaseM: number }
  floors: Record<FloorId, FloorSource>
}
const spatial = rawSpatial as SpatialModel
const plans = rawPlans.floors
const ptPerM = spatial.calibration.pointsPerMeter
const floorOrder = ['level-1', 'level-2', 'level-3'] as const
type FloorId = 'garage' | 'level-1' | 'level-2' | 'level-3'
type StageView = 'one' | 'all'
type StageArrangement = 'assembled' | 'exploded'
const globalOrigin = { x: 600, y: 350 }
const pX = (pt: number) => (pt - globalOrigin.x) / ptPerM
const pZ = (pt: number) => (pt - globalOrigin.y) / ptPerM
const vertical = (floor: FloorId, arrangement: StageArrangement) => {
  if (floor === 'garage' || floor === 'level-1') return 0
  if (arrangement === 'exploded') return floor === 'level-2' ? 4.5 : 9
  return floor === 'level-2' ? 2.93 : spatial.displayAssumptions.level3BaseM
}

function toShape(polygon: Polygon): THREE.Shape | null {
  if (polygon.outer.length < 3) return null
  const move = (path: THREE.Path, points: Ring) => {
    path.moveTo(pX(points[0][0]), -pZ(points[0][1]))
    for (let i = 1; i < points.length; i++) path.lineTo(pX(points[i][0]), -pZ(points[i][1]))
    path.closePath()
  }
  const shape = new THREE.Shape()
  move(shape, polygon.outer)
  for (const ring of polygon.holes) {
    if (ring.length < 3) continue
    const hole = new THREE.Path()
    move(hole, ring)
    shape.holes.push(hole)
  }
  return shape
}

function extrusion(shape: THREE.Shape, height: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, steps: 1, bevelEnabled: false, curveSegments: 4 })
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function roomSprite(value: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#d6c2a1'
  ctx.beginPath(); ctx.arc(64, 64, 47, 0, Math.PI * 2); ctx.fill()
  ctx.lineWidth = 4; ctx.strokeStyle = '#18322d'; ctx.stroke()
  ctx.fillStyle = '#17312b'; ctx.font = 'bold 53px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(String(value), 64, 68)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }))
  sprite.scale.set(.78, .78, 1)
  sprite.userData.roomNumber = value
  return sprite
}

function wallAndSlabGroup(floorId: FloorId, height: number, current: boolean, detail: boolean) {
  const data = spatial.floors[floorId]
  const group = new THREE.Group()
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: current ? '#ddd5c3' : '#889e92', metalness: .04, roughness: .76,
    transparent: !current, opacity: current ? 1 : .47, side: THREE.DoubleSide,
  })
  const slabMaterial = new THREE.MeshStandardMaterial({ color: current ? '#d0cab8' : '#6e8880', roughness: .95,
    transparent: !current, opacity: current ? .95 : .42, side: THREE.DoubleSide })
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: '#354941', transparent: true, opacity: .3 })
  for (const polygon of data.slabEnvelopePt) {
    const shape = toShape(polygon)
    if (!shape) continue
    const mesh = new THREE.Mesh(extrusion(shape, spatial.displayAssumptions.slabThicknessM), slabMaterial)
    mesh.position.y = -.17
    mesh.receiveShadow = true
    group.add(mesh)
  }
  if (detail) for (const polygon of data.wallPolygonsPt) {
    const shape = toShape(polygon)
    if (!shape) continue
    const geom = extrusion(shape, height)
    const mesh = new THREE.Mesh(geom, wallMaterial)
    mesh.castShadow = current
    mesh.receiveShadow = true
    group.add(mesh)
    // High contrast only for major elements; do not add thousands of duplicate edges.
    if (polygon.outer.length < 100 && polygon.holes.length === 0) {
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 18), edgeMaterial)
      group.add(outline)
    }
  }
  group.userData.floor = floorId
  return group
}

async function inflateSvg(encoded: string) {
  const bytes = Uint8Array.from(atob(encoded), x => x.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  const svg = await new Response(stream).text()
  if (!svg.startsWith('<svg ') || /<script|<image\b|<foreignObject/i.test(svg)) throw new Error('Недопустимый SVG')
  return svg
}

async function furnitureOverlay(floor: FloorId): Promise<THREE.Mesh> {
  const source = spatial.floors[floor].sourceViewport
  const svg = await inflateSvg(furnitureVectors[floor])
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Не удалось распаковать мебельный план'))
      img.src = url
    })
    const ratio = Math.min(2.0, 2100 / source.widthPt)
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(source.widthPt * ratio)
    canvas.height = Math.ceil(source.heightPt * ratio)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const a = pixels.data
    // Remove the white PDF-paper background: objects remain as source 2D ink laid on a 3D plane.
    for (let i = 0; i < a.length; i += 4) {
      const min = Math.min(a[i], a[i + 1], a[i + 2])
      if (min >= 244) a[i + 3] = 0
      else if (min >= 228) a[i + 3] = Math.min(a[i + 3], Math.round((244 - min) / 16 * 255))
    }
    ctx.putImageData(pixels, 0, 0)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    const geometry = new THREE.PlaneGeometry(source.widthPt / ptPerM, source.heightPt / ptPerM)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: .77 })
    const plane = new THREE.Mesh(geometry, material)
    plane.rotation.x = -Math.PI / 2
    plane.position.set(pX(source.xPt + source.widthPt / 2), .035, pZ(source.yPt + source.heightPt / 2))
    plane.renderOrder = 3
    plane.userData.source = `MÈTRE ${plans[floor].furnitureSheet} · source 2D projection`
    return plane
  } finally { URL.revokeObjectURL(url) }
}

function disposeSceneGroup(obj: THREE.Object3D) {
  obj.traverse(child => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite || child instanceof THREE.LineSegments) {
      child.geometry?.dispose()
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const m of mats) {
        if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose()
        m.dispose()
      }
    }
  })
}

export default function Villa3D({ floorId, selectedRoom, onSelectRoom }: {
  floorId: FloorId
  selectedRoom: number | null
  onSelectRoom: (value: number) => void
}) {
  const mount = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const drawingsRef = useRef<THREE.Group | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const onSelectRef = useRef(onSelectRoom)
  const [view, setView] = useState<StageView>('one')
  const [arrangement, setArrangement] = useState<StageArrangement>('exploded')
  const [furniture, setFurniture] = useState(true)
  const [labels, setLabels] = useState(true)
  const [walls, setWalls] = useState(true)
  const [top, setTop] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingTexture, setLoadingTexture] = useState(false)
  onSelectRef.current = onSelectRoom
  const viewAll = view === 'all' && floorId !== 'garage'

  useEffect(() => {
    if (!mount.current) return
    const container = mount.current
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    } catch (e) {
      setError('3D недоступен: браузер не смог запустить WebGL. ' + String(e))
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
    renderer.setSize(container.clientWidth || 700, container.clientHeight || 550)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.25
    rendererRef.current = renderer
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#142323')
    scene.fog = new THREE.Fog('#142323', 70, 125)
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(36, 1, .04, 200)
    camera.position.set(24, 29, 31)
    cameraRef.current = camera
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = .07
    controls.minDistance = 3
    controls.maxDistance = 96
    controls.maxPolarAngle = Math.PI / 2.02
    controls.target.set(0, 1.7, 0)
    controls.update()
    controlsRef.current = controls
    scene.add(new THREE.HemisphereLight('#f4f6ff', '#33443c', 2.0))
    const key = new THREE.DirectionalLight('#ffefd4', 3)
    key.position.set(-17, 32, 20)
    key.castShadow = true
    key.shadow.mapSize.set(1536, 1536)
    key.shadow.camera.left = -34; key.shadow.camera.right = 34
    key.shadow.camera.top = 34; key.shadow.camera.bottom = -34
    key.shadow.normalBias = .018
    scene.add(key)
    const fill = new THREE.DirectionalLight('#9ac8bb', 1.3)
    fill.position.set(20, 16, -17)
    scene.add(fill)
    const grid = new THREE.GridHelper(100, 100, '#3b5751', '#253c38')
    grid.position.y = -.41
    ;(grid.material as THREE.LineBasicMaterial).transparent = true
    ;(grid.material as THREE.LineBasicMaterial).opacity = .42
    scene.add(grid)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.ShadowMaterial({ opacity: .22 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -.43
    ground.receiveShadow = true
    scene.add(ground)
    let frame = 0
    const draw = () => { frame = requestAnimationFrame(draw); controls.update(); renderer.render(scene, camera) }
    draw()
    const resize = new ResizeObserver(() => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight)
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
    })
    resize.observe(container)
    const onClick = (event: MouseEvent) => {
      if (!drawingsRef.current || !cameraRef.current) return
      const rect = renderer.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      const ray = new THREE.Raycaster()
      ray.setFromCamera(mouse, camera)
      const hits = ray.intersectObjects(drawingsRef.current.children, true)
      const marker = hits.find(hit => Number.isInteger(hit.object.userData.roomNumber))
      if (marker) onSelectRef.current(marker.object.userData.roomNumber as number)
    }
    renderer.domElement.addEventListener('click', onClick)
    return () => {
      renderer.domElement.removeEventListener('click', onClick)
      resize.disconnect(); cancelAnimationFrame(frame)
      if (drawingsRef.current) { scene.remove(drawingsRef.current); disposeSceneGroup(drawingsRef.current) }
      drawingsRef.current = null
      controls.dispose(); renderer.dispose(); renderer.domElement.remove()
      rendererRef.current = null; controlsRef.current = null; cameraRef.current = null; sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    let live = true
    const previous = drawingsRef.current
    if (previous) { scene.remove(previous); disposeSceneGroup(previous) }
    const all = viewAll ? [...floorOrder] : [floorId]
    const root = new THREE.Group()
    drawingsRef.current = root
    scene.add(root)
    for (const id of all) {
      const current = id === floorId
      const base = viewAll ? vertical(id, arrangement) : 0
      const group = wallAndSlabGroup(id, id === 'level-3' ? 2.3 : spatial.displayAssumptions.wallHeightM, current, walls)
      group.position.y = base
      root.add(group)
      if (current && labels) {
        for (const room of plans[id].rooms) {
          if (!room.marker) continue
          const item = roomSprite(room.number)
          const vp = spatial.floors[id].sourceViewport
          item.position.set(pX(vp.xPt + room.marker[0]), base + .22, pZ(vp.yPt + room.marker[1]))
          group.add(item)
        }
      }
    }
    if (furniture) {
      setLoadingTexture(true)
      furnitureOverlay(floorId).then(mesh => {
        if (!live) { disposeSceneGroup(mesh); return }
        mesh.position.y += viewAll ? vertical(floorId, arrangement) : 0
        root.add(mesh)
        setLoadingTexture(false)
      }).catch(e => { if (live) { setLoadingTexture(false); setError('Не удалось загрузить мебельную проекцию: ' + String(e)) } })
    } else setLoadingTexture(false)
    return () => { live = false }
  }, [floorId, viewAll, arrangement, furniture, walls, labels])

  useEffect(() => {
    drawingsRef.current?.traverse(item => {
      if (item instanceof THREE.Sprite && Number.isInteger(item.userData.roomNumber)) {
        const scale = item.userData.roomNumber === selectedRoom ? 1.12 : .78
        item.scale.set(scale, scale, 1)
      }
    })
  }, [selectedRoom, floorId, labels, viewAll])

  const resetCamera = (plan: boolean) => {
    const cam = cameraRef.current, control = controlsRef.current
    if (!cam || !control) return
    control.target.set(0, viewAll ? 4 : 1, 0)
    cam.position.set(plan ? 0.01 : 23, plan ? 38 : (viewAll ? 34 : 27), plan ? .01 : 32)
    cam.up.set(0, 0, plan ? -1 : 0)
    if (!plan) cam.up.set(0, 1, 0)
    control.update()
    setTop(plan)
  }
  const zoomCamera = (factor: number) => {
    const cam = cameraRef.current, target = controlsRef.current?.target
    if (!cam || !target) return
    const vec = cam.position.clone().sub(target).multiplyScalar(factor)
    cam.position.copy(target).add(vec)
    controlsRef.current?.update()
  }

  return <div className="villa3d">
    <div className="model-top-strip">
      <div className="model-title"><span className="live-indicator"/><b>3D · АВТОМАТИЧЕСКАЯ ГЕНЕРАЦИЯ</b><small>{spatial.floors[floorId].sourceSheet} → объём стен</small></div>
      <div className="model-tools">
        <button onClick={() => zoomCamera(1.22)} aria-label="Отдалить 3D">−</button>
        <button onClick={() => zoomCamera(.82)} aria-label="Приблизить 3D">+</button>
        <button onClick={() => resetCamera(!top)}>{top ? 'Изометрия' : 'Сверху'}</button>
        <button onClick={() => resetCamera(false)}>Сброс</button>
      </div>
    </div>
    <div className="model-layers">
      <div className="model-switches" role="group" aria-label="Показ 3D уровней">
        <button className={!viewAll ? 'selected' : ''} onClick={() => setView('one')}>Один этаж</button>
        <button className={viewAll ? 'selected' : ''} onClick={() => setView('all')} disabled={floorId === 'garage'} title={floorId === 'garage' ? 'Гараж без проверенной привязки к дому' : undefined}>Все этажи</button>
        {viewAll && <button className="mode-light" onClick={() => setArrangement(v => v === 'assembled' ? 'exploded' : 'assembled')}>{arrangement === 'exploded' ? 'Собрать уровни' : 'Раздвинуть уровни'}</button>}
      </div>
      <div className="model-checks">
        <button aria-pressed={walls} onClick={() => setWalls(x => !x)} className={walls ? 'active' : ''}>Стены</button>
        <button aria-pressed={furniture} onClick={() => setFurniture(x => !x)} className={furniture ? 'active' : ''}>Мебель · 2D</button>
        <button aria-pressed={labels} onClick={() => setLabels(x => !x)} className={labels ? 'active' : ''}>Помещения</button>
      </div>
    </div>
    <div className="model-viewport" ref={mount} aria-label="Интерактивная 3D модель этажей Villa Como: перетаскивайте для вращения, колесо мыши для масштаба">
      {error && <div className="model-error" role="alert">{error}<button onClick={() => setError(null)}>Закрыть</button></div>}
      <div className="model-overlay">
        <span className="model-eyebrow">MÈTRE / SOURCE-BASED 3D</span>
        <b>{floorId === 'garage' ? 'ГАРАЖ · ОТДЕЛЬНО' : viewAll ? 'ЭТАЖИ 1–3' : floorId === 'level-1' ? 'ПЕРВЫЙ ЭТАЖ' : floorId === 'level-2' ? 'ВТОРОЙ ЭТАЖ' : 'ТРЕТИЙ ЭТАЖ'}</b>
        <small>{spatial.floors[floorId].wallPolygonCount} конструктивных контуров</small>
      </div>
      <div className="model-gesture-hint">↻ Вращайте · ≋ Увеличивайте · Выбирайте помещения</div>
      {loadingTexture && <div className="model-loading">Проекция мебели загружается…</div>}
    </div>
    <div className="model-footnote"><span>Стеновые контуры: {spatial.floors[floorId].sourceSheet} · из PDF; мебель: плоская проекция {plans[floorId].furnitureSheet}</span><strong>ПРЕДВАРИТЕЛЬНАЯ 3D · НЕ BIM</strong></div>
    <div className="model-warning">Объёмные стены построены из реальных 2D-контуров. <b>Высоты стен, толщина плит и отметка мансарды пока условны.</b> Вырезы проёмов и объёмная мебель не воссозданы и не должны считаться точными. Кровля и расположение гаража на участке требуют отсутствующих исходных материалов.</div>
  </div>
}
