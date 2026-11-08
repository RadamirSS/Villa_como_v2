import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import rawSpatial from '../data/spatial-model.json'
import rawArchitectural from '../data/architectural-geometry.json'
import rawPlans from '../data/architectural-plans.json'
import furnitureVectors from '../data/furniture-vectors.json'
import { createExteriorConcept, createExteriorContext, exteriorConcept } from './ExteriorConcept'

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
type DoorAxis = {
  status: string
  startPt?: number[]
  endPt?: number[]
}
type SourceDoor = {
  id: string
  mark: string
  sourceLeafSegmentPt: number[][]
  openingWidthMm: number
  openingHeightMm: number
  leafWidthMm: number
  leafHeightMm: number
  symbolMatchDistancePt: number
  aperture: DoorAxis
}
type ArchitecturalData = {
  floors: Record<FloorId, {
    doors: SourceDoor[]
    openingCountResolved: number
    calibrationChecks: {
      label: string
      sheet: string
      dimensionMm: number
      observedLengthPt: number
      residualAtDisplayScalePct: number
      scalePointsPerM: number
    }[]
  }>
}
const architecture = rawArchitectural as ArchitecturalData
const spatial = rawSpatial as SpatialModel
const plans = rawPlans.floors
const ptPerM = spatial.calibration.pointsPerMeter
const floorOrder = ['level-1', 'level-2', 'level-3'] as const
type FloorId = 'garage' | 'level-1' | 'level-2' | 'level-3'
type StageView = 'one' | 'all'
type StageArrangement = 'assembled' | 'exploded'
type PresentationMode = 'exterior' | 'section' | 'source'
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
  if (detail) for (const [wallIndex, polygon] of data.wallPolygonsPt.entries()) {
    const shape = toShape(polygon)
    if (!shape) continue
    const geom = extrusion(shape, height)
    const mesh = new THREE.Mesh(geom, wallMaterial)
    mesh.castShadow = current
    mesh.receiveShadow = true
    mesh.userData.wallId = rawArchitectural.floors[floorId].sourceWalls[wallIndex].id
    mesh.userData.confidence = 'source-wall-fill-footprint'
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

/**
 * Only the original door leaf line in plan has source-certified XY position.
 * Door heights/sizes are drawn from the A-14..17 door schedule. The leaf is
 * intentionally shown ajar at the angle printed in the source drawing;
 * exact jamb/hinge build-up and overhead lintel depth remain provisional.
 */
function sourceDoorGroup(floorId: FloorId, current: boolean, drawLintels: boolean) {
  const group = new THREE.Group()
  const leaves = architecture.floors[floorId].doors
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: current ? '#ba9b74' : '#a7a99c', roughness: .78, metalness: .03,
    transparent: true, opacity: current ? .89 : .36, side: THREE.DoubleSide,
  })
  const lintelMaterial = new THREE.MeshStandardMaterial({
    color: current ? '#d0c6b3' : '#859b8f', roughness: .93,
    transparent: true, opacity: current ? .88 : .36,
  })
  for (const door of leaves) {
    const [start, end] = door.sourceLeafSegmentPt
    const a = new THREE.Vector3(pX(start[0]), 0, pZ(start[1]))
    const b = new THREE.Vector3(pX(end[0]), 0, pZ(end[1]))
    const vector = b.clone().sub(a)
    const span = vector.length()
    const leafHeight = door.leafHeightMm / 1000
    if (span > .15 && span < 3) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(span, leafHeight, .045), leafMaterial)
      panel.position.copy(a.clone().add(b).multiplyScalar(.5))
      panel.position.y = leafHeight / 2 + .015
      panel.rotation.y = -Math.atan2(vector.z, vector.x)
      panel.userData = { doorMark: door.mark, floorId, sourceVerified: 'plan-symbol-and-schedule' }
      panel.castShadow = current
      group.add(panel)
    }
    // Do not invent masonry over a doorway whose opening direction is ambiguous.
    if (!drawLintels || door.aperture.status !== 'source-gap-correlated-not-construction-approved'
      || !door.aperture.startPt || !door.aperture.endPt) continue
    const startPortal = door.aperture.startPt
    const endPortal = door.aperture.endPt
    const openingHeight = door.openingHeightMm / 1000
    const wallHeight = floorId === 'level-3' ? 2.3 : spatial.displayAssumptions.wallHeightM
    const above = wallHeight - openingHeight
    if (above < .045) continue
    const v0 = new THREE.Vector3(pX(startPortal[0]), 0, pZ(startPortal[1]))
    const v1 = new THREE.Vector3(pX(endPortal[0]), 0, pZ(endPortal[1]))
    const along = v1.clone().sub(v0)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(along.length(), above, .115), lintelMaterial)
    mesh.position.copy(v0.add(v1).multiplyScalar(.5))
    mesh.position.y = openingHeight + above / 2
    mesh.rotation.y = -Math.atan2(along.z, along.x)
    mesh.userData = { doorMark: door.mark, floorId, provisional: 'wall-thickness-and-lintel-inference' }
    mesh.castShadow = current
    group.add(mesh)
  }
  return group
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
  const [view, setView] = useState<StageView>('all')
  const [arrangement, setArrangement] = useState<StageArrangement>('assembled')
  const [presentation, setPresentation] = useState<PresentationMode>('exterior')
  const [roof, setRoof] = useState(true)
  const [glazing, setGlazing] = useState(true)
  const [terrace, setTerrace] = useState(true)
  const [furniture, setFurniture] = useState(false)
  const [labels, setLabels] = useState(false)
  const [walls, setWalls] = useState(true)
  const [doors, setDoors] = useState(true)
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
    scene.background = new THREE.Color('#b9cecb')
    scene.fog = new THREE.Fog('#b9cecb', 75, 160)
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
    const exteriorContext = createExteriorContext()
    scene.add(exteriorContext)
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
      disposeSceneGroup(exteriorContext); scene.remove(exteriorContext)
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
    const isExterior = presentation === 'exterior'
    if (isExterior) {
      // Exterior is expressly a conceptual wrapper over the registered source footprint.
      // Roof/facade and window heights cannot be read from absent elevation drawings.
      root.add(createExteriorConcept({ floors: all, roof, windows: glazing, terrace, garage: true,
        assembled: arrangement === 'assembled' && (viewAll || floorId === 'garage') }))
    } else {
      for (const id of all) {
        const current = id === floorId
        const base = viewAll ? vertical(id, arrangement) : 0
        const group = wallAndSlabGroup(id, id === 'level-3' ? 2.3 : spatial.displayAssumptions.wallHeightM, current, walls)
        group.position.y = base
        root.add(group)
        if (walls && doors) {
          const doorGroup = sourceDoorGroup(id, current, true)
          doorGroup.position.y = base
          root.add(doorGroup)
        }
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
    }
    if (isExterior) setLoadingTexture(false)
    return () => { live = false }
  }, [floorId, viewAll, arrangement, furniture, walls, doors, labels, presentation, roof, glazing, terrace])

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
      <div className="model-title"><span className="live-indicator"/><b>3D · ВИЛЛА COMO / ПАКЕТ Б</b><small>{presentation === 'exterior' ? 'КОНЦЕПЦИЯ ФАСАДОВ И КРОВЛИ' : `${spatial.floors[floorId].sourceSheet} · исходная архитектура`}</small></div>
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
        <button className={viewAll ? 'selected' : ''} onClick={() => { setView('all'); setArrangement('assembled') }} disabled={floorId === 'garage'} title={floorId === 'garage' ? 'Гараж без проверенной привязки к дому' : undefined}>Все этажи</button>
        {viewAll && <button className="mode-light" onClick={() => { setPresentation('section'); setArrangement(v => v === 'assembled' ? 'exploded' : 'assembled') }}>{arrangement === 'exploded' ? 'Собрать уровни' : 'Раздвинуть уровни'}</button>}
      </div>
      <div className="model-presentation" role="group" aria-label="Режим архитектурной визуализации">
        <button className={presentation === 'exterior' ? 'selected' : ''} aria-pressed={presentation === 'exterior'} onClick={() => { setPresentation('exterior'); setView('all'); setArrangement('assembled'); resetCamera(false) }}>Готовый дом</button>
        <button className={presentation === 'section' ? 'selected' : ''} aria-pressed={presentation === 'section'} onClick={() => setPresentation('section')}>Без оболочки</button>
        <button className={presentation === 'source' ? 'selected' : ''} aria-pressed={presentation === 'source'} onClick={() => setPresentation('source')}>Исходные стены</button>
      </div>
      <div className="model-checks">
        {presentation === 'exterior' ? <>
          <button aria-pressed={roof} onClick={() => setRoof(x => !x)} className={roof ? 'active' : ''}>Крыша</button>
          <button aria-pressed={glazing} onClick={() => setGlazing(x => !x)} className={glazing ? 'active' : ''}>Остекление</button>
          <button aria-pressed={terrace} onClick={() => setTerrace(x => !x)} className={terrace ? 'active' : ''}>Терраса</button>
        </> : <>
          <button aria-pressed={walls} onClick={() => setWalls(x => !x)} className={walls ? 'active' : ''}>Стены</button>
          <button aria-pressed={doors} onClick={() => setDoors(x => !x)} className={doors ? 'active' : ''}>Двери · 3D</button>
          <button aria-pressed={furniture} onClick={() => setFurniture(x => !x)} className={furniture ? 'active' : ''}>Мебель · 2D</button>
          <button aria-pressed={labels} onClick={() => setLabels(x => !x)} className={labels ? 'active' : ''}>Помещения</button>
        </>}
      </div>
    </div>
    <div className="model-viewport" ref={mount} aria-label="Интерактивная 3D модель этажей Villa Como: перетаскивайте для вращения, колесо мыши для масштаба">
      {error && <div className="model-error" role="alert">{error}<button onClick={() => setError(null)}>Закрыть</button></div>}
      <div className="model-overlay">
        <span className="model-eyebrow">{presentation === 'exterior' ? 'EXTERIOR CONCEPT / NOT PROJECT ELEVATIONS' : 'MÈTRE / SOURCE-BASED 3D'}</span>
        <b>{floorId === 'garage' ? 'ГАРАЖ · ОТДЕЛЬНО' : viewAll ? 'ЭТАЖИ 1–3' : floorId === 'level-1' ? 'ПЕРВЫЙ ЭТАЖ' : floorId === 'level-2' ? 'ВТОРОЙ ЭТАЖ' : 'ТРЕТИЙ ЭТАЖ'}</b>
        <small>{presentation === 'exterior' ? `${exteriorConcept.floors[floorId].facadeSegments.length} линий фасада · ${exteriorConcept.floors[floorId].windowsApproxCount} условных окон` : `${spatial.floors[floorId].wallPolygonCount} стен · ${architecture.floors[floorId].doors.length} дверей`}</small>
      </div>
      <div className="model-gesture-hint">↻ Вращайте · ≋ Увеличивайте · Выбирайте помещения</div>
      {loadingTexture && <div className="model-loading">Проекция мебели загружается…</div>}
    </div>
    <div className="model-footnote"><span>{presentation === 'exterior' ? `Внешний контур: ${exteriorConcept.floors[floorId].sourceSheet} · облицовка, крыша и окна — концепция` : `Стеновые контуры: ${spatial.floors[floorId].sourceSheet} · мебель: ${plans[floorId].furnitureSheet}`}</span><strong>{presentation === 'exterior' ? 'ДЕМОНСТРАЦИЯ · НЕ УТВЕРЖДЁННЫЙ ФАСАД' : 'ПРЕДВАРИТЕЛЬНАЯ 3D · НЕ BIM'}</strong></div>
    <details className="architecture-calibration" open>
      <summary>Геометрический контроль · {architecture.floors[floorId].calibrationChecks.length} независимые размерные привязки</summary>
      <div className="calibration-row-head"><span>Исходный лист</span><span>Размер</span><span>Расхождение с моделью</span></div>
      {architecture.floors[floorId].calibrationChecks.map((check, index) => <div key={index} className="calibration-row">
        <span>{check.sheet} · {check.label}</span>
        <b>{check.dimensionMm.toLocaleString('ru-RU')} мм</b>
        <strong>{check.residualAtDisplayScalePct > 0 ? '+' : ''}{check.residualAtDisplayScalePct.toFixed(2)}%</strong>
      </div>)}
      <small>Расхождение измерений в PDF с масштабом предпросмотра; не погрешность готового строительного CAD. Размерные цепочки полностью не замкнуты.</small>
    </details>
    <div className="model-warning">{presentation === 'exterior' ? <>
      <b>Фасады, остекление, крыша и материалы — демонстрационная реконструкция.</b> Их геометрия следует очертаниям A-14–A-17, но в исходном 94-страничном PDF нет полного плана кровли, фасадов, разрезов и генплана. Отметки и композиция окон не утверждены. Гараж показан отдельно, его положение относительно виллы не задано. Режим «Без оболочки» возвращает исходные объёмные стены.
    </> : <>
      Контуры стен и положения {architecture.floors[floorId].doors.length} дверных полотен перенесены из PDF, размеры дверей — из ведомости {spatial.floors[floorId].sourceSheet}. <b>{architecture.floors[floorId].openingCountResolved} проёмов сопоставлены с просветами на плане, остальные оставлены неразрешёнными.</b> Конструктивная крыша и фасады пока не подтверждены.
    </>}</div>
  </div>
}
