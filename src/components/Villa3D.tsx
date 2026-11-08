import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createInterior3D } from './Interior3D'
import { SVGRenderer, SVGObject } from 'three/examples/jsm/renderers/SVGRenderer.js'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import rawSpatial from '../data/spatial-model.json'
import rawArchitectural from '../data/architectural-geometry.json'
import rawPlans from '../data/architectural-plans.json'
import { createExteriorConcept, createExteriorContext, exteriorConcept, registrationMetres, createUnusedAttic } from './ExteriorConcept'

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


function vectorRoomMarker(value: number, select: () => void) {
  const ns = 'http://www.w3.org/2000/svg'
  const node = document.createElementNS(ns, 'g')
  node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0')
  node.setAttribute('aria-label', `Помещение ${value}`)
  node.style.cursor = 'pointer'
  const circle = document.createElementNS(ns, 'circle')
  circle.setAttribute('r', '12'); circle.setAttribute('fill', '#dbc399'); circle.setAttribute('stroke', '#294e40')
  const text = document.createElementNS(ns, 'text')
  text.textContent = String(value); text.setAttribute('text-anchor', 'middle'); text.setAttribute('dy', '.35em')
  text.setAttribute('font-size', '11'); text.setAttribute('font-family', 'system-ui'); text.setAttribute('fill', '#183b2c')
  node.append(circle, text)
  node.addEventListener('click', select)
  node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select() } })
  const marker = new SVGObject(node); marker.userData.roomNumber = value
  return marker
}

export function wallAndSlabGroup(floorId: FloorId, height: number, current: boolean, detail: boolean, overview = false) {
  const data = spatial.floors[floorId]
  const group = new THREE.Group()
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: current ? '#ddd5c3' : '#889e92', metalness: .04, roughness: .76,
    transparent: !current, opacity: current ? 1 : .47, side: THREE.DoubleSide,
  })
  const slabMaterial = new THREE.MeshStandardMaterial({ color: current ? '#d0cab8' : '#6e8880', roughness: .95,
    transparent: !current, opacity: current ? .95 : .42, side: THREE.DoubleSide })
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: '#354941', transparent: true, opacity: .3 })
  for (const polygon of overview ? [{outer:exteriorConcept.floors[floorId].outlinePt,holes:[]}, ...(floorId === 'level-2' ? [{outer:exteriorConcept.terrace.polygonPt,holes:[]}] : [])] : data.slabEnvelopePt) {
    const shape = toShape(polygon)
    if (!shape) continue
    const mesh = new THREE.Mesh(extrusion(shape, spatial.displayAssumptions.slabThicknessM), slabMaterial)
    mesh.position.y = -spatial.displayAssumptions.slabThicknessM
    mesh.userData.floorSlab=true
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

/**
 * Only the original door leaf line in plan has source-certified XY position.
 * Door heights/sizes are drawn from the A-14..17 door schedule. The leaf is
 * intentionally shown ajar at the angle printed in the source drawing;
 * exact jamb/hinge build-up and overhead lintel depth remain provisional.
 */
function sourceDoorGroup(floorId: FloorId, current: boolean, drawLintels: boolean, limit = Infinity) {
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
    const leafHeight = Math.min(limit, door.leafHeightMm / 1000)
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

function disposeSceneGroup(obj: THREE.Object3D) {
  obj.traverse(child => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite || child instanceof THREE.Line) {
      child.geometry?.dispose()
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const m of mats) {
        if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose()
        m.dispose()
      }
    }
  })
}

export default function Villa3D({ floorId, selectedRoom, onSelectRoom, floorSelectionRevision = 0 }: {
  floorId: FloorId
  floorSelectionRevision?: number
  selectedRoom: number | null
  onSelectRoom: (value: number) => void
}) {
  const mount = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const drawingsRef = useRef<THREE.Group | null>(null)
  const contextRef = useRef<THREE.Group | null>(null)
  const boundsRef = useRef(new THREE.Box3())
  const poseRef = useRef<'perspective' | 'front' | 'rear' | 'side' | 'top' | 'floor' | 'kitchen'>('perspective')
  const fitKeyRef = useRef('')
  const invalidateRef = useRef(() => {})
  const fitCameraRef = useRef(() => {})
  const onSelectRef = useRef(onSelectRoom)
  const [view, setView] = useState<StageView>('all')
  const [arrangement, setArrangement] = useState<StageArrangement>('assembled')
  const [presentation, setPresentation] = useState<PresentationMode>('exterior')
  const [roof, setRoof] = useState(true)
  const [glazing, setGlazing] = useState(true)
  const [terrace, setTerrace] = useState(true)
  const [furniture, setFurniture] = useState(true)
  const [detailRoom, setDetailRoom] = useState<number | null>(null)
  const [labels, setLabels] = useState(true)
  const [showGarage, setShowGarage] = useState(true)
  const [walls, setWalls] = useState(true)
  const [doors, setDoors] = useState(true)
  const [top, setTop] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingTexture, setLoadingTexture] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [site, setSite] = useState(true)
  const [expanded, setExpanded] = useState(false)
  onSelectRef.current = onSelectRoom
  const viewAll = view === 'all'

  useEffect(() => {
    if (!floorSelectionRevision) return
    poseRef.current = 'floor'; setTop(false); setDetailRoom(null)
    setView('one'); setArrangement('assembled'); setPresentation('section'); setLabels(true)
  }, [floorSelectionRevision])

  useEffect(() => {
    if (!mount.current) return
    const container = mount.current
    let webgl: THREE.WebGLRenderer | null = null
    let renderer: { domElement: HTMLElement | SVGElement; setSize: (w: number, h: number) => void; render: (s: THREE.Scene, c: THREE.Camera) => void }
    try {
      webgl = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' })
      webgl.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
      webgl.shadowMap.enabled = true
      webgl.shadowMap.type = THREE.PCFSoftShadowMap
      webgl.outputColorSpace = THREE.SRGBColorSpace
      webgl.toneMapping = THREE.ACESFilmicToneMapping
      webgl.toneMappingExposure = 1.05
      renderer = webgl
      setFallback(false)
    } catch {
      // Same scene, meshes and camera; a graceful vector rendering on devices
      // without WebGL. No prerecorded image, independent model, or fake view.
      const svg = new SVGRenderer()
      svg.setQuality('high'); svg.setPrecision(3)
      renderer = svg
      setFallback(true)
    }
    renderer.setSize(container.clientWidth || 700, container.clientHeight || 550)
    renderer.domElement.setAttribute('data-renderer', webgl ? 'webgl' : 'svg')
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#e4e7df')
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera(35, 1, .1, 300)
    camera.position.set(28, 24, 34)
    cameraRef.current = camera
    const controls = new OrbitControls(camera, renderer.domElement as HTMLElement)
    controls.enableDamping = !!webgl
    controls.dampingFactor = .08
    controls.minDistance = 5
    controls.maxDistance = 120
    controls.maxPolarAngle = Math.PI * .485
    controls.target.set(0, 3.4, 0)
    controls.update()
    controlsRef.current = controls
    // SVGRenderer sums ambient colour and ignores intensity; encode its ambient level in colour.
    scene.add(new THREE.AmbientLight(webgl ? '#ffffff' : '#959b9a', webgl ? .7 : 1))
    scene.add(new THREE.HemisphereLight('#fff7e7', '#747d69', webgl ? 1.5 : 0))
    const key = new THREE.DirectionalLight(webgl ? '#fff4e2' : '#ffffff', webgl ? 2.6 : .6)
    key.position.set(-16, 28, 18)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -26; key.shadow.camera.right = 26
    key.shadow.camera.top = 26; key.shadow.camera.bottom = -26
    key.shadow.normalBias = .025
    scene.add(key)
    const fill = new THREE.DirectionalLight('#d3e2df', webgl ? .8 : .25)
    fill.position.set(20, 14, -18)
    scene.add(fill)
    let dirty = true
    const invalidate = () => { dirty = true }
    invalidateRef.current = invalidate
    controls.addEventListener('change', invalidate)
    fitCameraRef.current = () => {
      const box = boundsRef.current
      if (box.isEmpty()) return
      const centre = box.getCenter(new THREE.Vector3())
      const poses = { perspective: [1,.68,1.35], front: [0,.35,1.6], rear: [0,.4,-1.6], side: [1.6,.4,.1], top: [.001,1,.001], floor: [.65,1.65,1.25], kitchen: [.25,1.15,1.65] }
      const direction = new THREE.Vector3(...poses[poseRef.current] as [number,number,number]).normalize()
      const cameraUp = poseRef.current === 'top' ? new THREE.Vector3(0,0,-1) : new THREE.Vector3(0,1,0)
      const right = new THREE.Vector3().crossVectors(cameraUp, direction).normalize()
      const up = new THREE.Vector3().crossVectors(direction, right).normalize()
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect
      let distance = 5
      for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
        const v = new THREE.Vector3(x,y,z).sub(centre), depth = v.dot(direction)
        distance = Math.max(distance, Math.abs(v.dot(right)) / tanH + depth, Math.abs(v.dot(up)) / tanV + depth)
      }
      controls.target.copy(centre)
      camera.up.copy(cameraUp)
      camera.position.copy(centre).addScaledVector(direction, distance * 1.10)
      controls.update(); dirty = true
    }
    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      controls.update()
      if (dirty) { dirty = false; renderer.render(scene, camera) }
    }
    draw()
    const resize = new ResizeObserver(() => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight)
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); fitCameraRef.current(); invalidate()
    })
    resize.observe(container)
    const onClick = (input: Event) => {
      const event = input as MouseEvent
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
      controls.removeEventListener('change', invalidate)
      disposeSceneGroup(scene)
      contextRef.current = null
      controls.dispose(); webgl?.dispose(); renderer.domElement.remove()
      invalidateRef.current = () => {}; fitCameraRef.current = () => {}
      controlsRef.current = null; cameraRef.current = null; sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const previous = drawingsRef.current
    if (previous) { scene.remove(previous); disposeSceneGroup(previous) }
    if (contextRef.current) { scene.remove(contextRef.current); disposeSceneGroup(contextRef.current); contextRef.current = null }
    if (site && presentation === 'exterior' && (viewAll || floorId === 'garage')) {
      contextRef.current = createExteriorContext(!viewAll && floorId === 'garage')
      scene.add(contextRef.current)
    }
    const all = viewAll ? [...floorOrder] : [floorId]
    const root = new THREE.Group()
    drawingsRef.current = root
    scene.add(root)
    const isExterior = presentation === 'exterior'
    if (isExterior) {
      // Exterior is expressly a conceptual wrapper over the registered source footprint.
      // Roof/facade and window heights cannot be read from absent elevation drawings.
      root.add(createExteriorConcept({ floors: all, roof, windows: glazing, terrace, garage: showGarage,
        assembled: arrangement === 'assembled' && (viewAll || floorId === 'garage') }))
    } else {
      for (const id of all) {
        const current = id === floorId
        const base = viewAll ? vertical(id, arrangement) : 0
        const overview = presentation === 'section'
        const group = wallAndSlabGroup(id, overview ? .55 : id === 'level-3' ? 2.3 : spatial.displayAssumptions.wallHeightM, current, walls, overview)
        const [offsetX, offsetZ] = registrationMetres(id)
        group.position.set(offsetX, base, offsetZ)
        root.add(group)
        if (walls && doors) {
          const doorGroup = sourceDoorGroup(id, current, !overview, overview ? .45 : Infinity)
          doorGroup.position.set(offsetX, base, offsetZ)
          root.add(doorGroup)
        }
        if (overview && id === 'level-3') {
          const unused=createUnusedAttic(); unused.position.y=base; root.add(unused)
          let label:THREE.Object3D
          if (fallback) {
            const node=document.createElementNS('http://www.w3.org/2000/svg','text');node.textContent='Неиспользуемый чердак';node.setAttribute('fill','#3d5146');node.setAttribute('font-size','12');node.setAttribute('text-anchor','middle')
            label=new SVGObject(node)
          } else {
            const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80
            const ctx=canvas.getContext('2d')!;ctx.fillStyle='#29433b';ctx.fillRect(0,0,512,80)
            ctx.fillStyle='#f2ecd9';ctx.font='600 28px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Неиспользуемый чердак',256,40)
            const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace
            const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,depthTest:false,transparent:true}));sprite.scale.set(5,.78,1);label=sprite
          }
          label.position.set(11,base+.8,1);label.userData.spaceKind='unused-attic';root.add(label)
        }
        if (current && labels) {
          for (const room of plans[id].rooms) {
            if (!room.marker) continue
            const item = fallback ? vectorRoomMarker(room.number, () => onSelectRef.current(room.number)) : roomSprite(room.number)
            const vp = spatial.floors[id].sourceViewport
            item.position.set(pX(vp.xPt + room.marker[0]), overview ? .72 : .22, pZ(vp.yPt + room.marker[1]))
            group.add(item)
          }
        }
      }
      if (furniture) {
        for(const id of all){
          const interior=createInterior3D(id,presentation === 'section',detailRoom)
          const [x,z]=registrationMetres(id)
          interior.position.set(x,viewAll?vertical(id,arrangement):0,z)
          root.add(interior)
        }
      }
      setLoadingTexture(false)
    }
    if (isExterior) setLoadingTexture(false)
    if (fallback) root.traverse(item => {
      if(item instanceof THREE.Mesh){
        // A selected floor is wholly below the furnishings. SVG has no depth buffer.
        if(!viewAll&&item.userData.floorSlab)item.renderOrder=-20
        if(item.parent?.userData.designSheets){const previous=item.geometry;item.geometry=new TessellateModifier(.5,7).modify(previous);previous.dispose()}
      }
      if (item instanceof THREE.Mesh && !Array.isArray(item.material) && item.material instanceof THREE.MeshPhysicalMaterial) {
        const material = item.material.clone(); material.transparent = false; material.opacity = 1; material.side = THREE.FrontSide
        item.material = material
      }
    })
    boundsRef.current.setFromObject(root)
    if(detailRoom!==null&&!viewAll&&!isExterior){
      const detailBounds=new THREE.Box3()
      root.updateMatrixWorld(true)
      root.traverse(obj=>{if(obj.userData.placementId&&obj.userData.roomNumber===detailRoom)detailBounds.expandByObject(obj)})
      if(!detailBounds.isEmpty()){
        // A detail is a furniture inspection view; the complete source floor is one click away.
        for(const child of root.children)if(!child.name.startsWith('furnished-'))child.visible=false
        root.traverse(obj=>{if(obj.userData.placementId&&obj.userData.roomNumber!==detailRoom)obj.visible=false})
        detailBounds.min.y=0
        const size=detailBounds.getSize(new THREE.Vector3()),centre=detailBounds.getCenter(new THREE.Vector3())
        const base=new THREE.Mesh(new THREE.BoxGeometry(size.x+.18,.06,size.z+.18),new THREE.MeshStandardMaterial({color:'#e6e2df',roughness:.95}))
        base.position.set(centre.x,-.03,centre.z);base.receiveShadow=true;base.renderOrder=-20;base.userData.presentationBase=true;root.add(base)
        boundsRef.current.copy(detailBounds)
      }
    }
    if (isExterior && viewAll && site) boundsRef.current.expandByPoint(new THREE.Vector3(32,0,31))
    const fitKey = `${floorId}-${viewAll}-${arrangement}-${presentation}-${detailRoom}`
    if (fitKeyRef.current !== fitKey) { fitKeyRef.current = fitKey; fitCameraRef.current() }
    invalidateRef.current()

  }, [floorId, viewAll, arrangement, furniture, walls, doors, labels, presentation, roof, glazing, terrace, site, fallback, showGarage, detailRoom])

  useEffect(() => {
    drawingsRef.current?.traverse(item => {
      if (item instanceof THREE.Sprite && Number.isInteger(item.userData.roomNumber)) {
        const scale = item.userData.roomNumber === selectedRoom ? 1.12 : .78
        item.scale.set(scale, scale, 1)
      }
    })
    invalidateRef.current()
  }, [selectedRoom, floorId, labels, viewAll])

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', escape) }
  }, [expanded])

  const setCameraPose = (pose: typeof poseRef.current) => {
    poseRef.current = pose; setTop(pose === 'top'); fitCameraRef.current()
  }
  const resetCamera = (plan: boolean) => setCameraPose(plan ? 'top' : 'perspective')
  const zoomCamera = (factor: number) => {
    const cam = cameraRef.current, target = controlsRef.current?.target
    if (!cam || !target) return
    const vec = cam.position.clone().sub(target).multiplyScalar(factor)
    cam.position.copy(target).add(vec)
    controlsRef.current?.update()
  }

  return <div className={`villa3d${expanded ? ' villa3d-expanded' : ''}`}>
    <div className="model-top-strip">
      <div className="model-title"><span className="live-indicator"/><b>VILLA COMO · АРХИТЕКТУРА</b><small>{detailRoom===12&&!viewAll&&presentation!=='exterior'?'Меблировка · A-118 / A-119':presentation === 'exterior' ? 'ДОМ НА СКЛОНЕ' : `${spatial.floors[floorId].sourceSheet} · исходная архитектура`}</small></div>
      <div className="model-tools">
        <button onClick={() => zoomCamera(1.22)} aria-label="Отдалить 3D">−</button>
        <button onClick={() => zoomCamera(.82)} aria-label="Приблизить 3D">+</button>
        <button onClick={() => resetCamera(!top)}>{top ? 'Изометрия' : 'Сверху'}</button>
        <button onClick={() => resetCamera(false)}>Сброс</button>
        <button onClick={() => setExpanded(v => !v)} aria-pressed={expanded}>{expanded ? 'Свернуть' : 'На весь экран'}</button>
      </div>
    </div>
    <div className="model-layers">
      <div className="model-switches" role="group" aria-label="Показ 3D уровней">
        <button className={!viewAll ? 'selected' : ''} onClick={() => { setDetailRoom(null);setView('one');setPresentation('section');setCameraPose('floor') }}>Обзор этажа</button>
        <button className={viewAll ? 'selected' : ''} onClick={() => { setDetailRoom(null);setView('all');setPresentation('exterior');setArrangement('assembled');setCameraPose('perspective') }}>Весь участок</button>
        {viewAll && <button className="mode-light" onClick={() => { setPresentation('section'); setArrangement(v => v === 'assembled' ? 'exploded' : 'assembled') }}>{arrangement === 'exploded' ? 'Собрать уровни' : 'Раздвинуть уровни'}</button>}
      </div>
      <div className="model-presentation" role="group" aria-label="Режим архитектурной визуализации">
        <button className={presentation === 'exterior' ? 'selected' : ''} aria-pressed={presentation === 'exterior'} onClick={() => { setDetailRoom(null);setPresentation('exterior'); setView('all'); setArrangement('assembled'); resetCamera(false) }}>Дом и участок</button>
        <button className={presentation === 'section' ? 'selected' : ''} aria-pressed={presentation === 'section'} onClick={() => {setDetailRoom(null);setPresentation('section');setView('one');setCameraPose('floor')}}>Низкие стены</button>
        <button className={presentation === 'source' ? 'selected' : ''} aria-pressed={presentation === 'source'} onClick={() => setPresentation('source')}>Исходные стены</button>
      </div>
      <div className="model-checks">
        {presentation === 'exterior' ? <>
          <button aria-pressed={showGarage} onClick={() => setShowGarage(x => !x)} className={showGarage ? 'active' : ''}>Гараж</button>
          <button aria-pressed={roof} onClick={() => setRoof(x => !x)} className={roof ? 'active' : ''}>Крыша</button>
          <button aria-pressed={glazing} onClick={() => setGlazing(x => !x)} className={glazing ? 'active' : ''}>Остекление</button>
          <button aria-pressed={site} onClick={() => setSite(x => !x)} className={site ? 'active' : ''}>Участок</button>
          <button aria-pressed={terrace} onClick={() => setTerrace(x => !x)} className={terrace ? 'active' : ''}>Терраса</button>
        </> : <>
          <button aria-pressed={walls} onClick={() => setWalls(x => !x)} className={walls ? 'active' : ''}>Стены</button>
          <button aria-pressed={doors} onClick={() => setDoors(x => !x)} className={doors ? 'active' : ''}>Двери · 3D</button>
          <button aria-pressed={furniture} onClick={() => setFurniture(x => !x)} className={furniture ? 'active' : ''}>Мебель и сантехника · 3D</button>
          <button aria-pressed={labels} onClick={() => setLabels(x => !x)} className={labels ? 'active' : ''}>Помещения</button>
        </>}
      </div>
    </div>
    <div className="model-camera-presets" role="group" aria-label="Ракурсы дома">
      <span>РАКУРС</span>
      {!viewAll&&presentation!=='exterior'&&floorId==='level-2'&&<button aria-pressed={detailRoom===12} onClick={()=>{poseRef.current='kitchen';setDetailRoom(12);setFurniture(true);setLabels(false);onSelectRoom(12)}}>Кухня крупно ↗</button>}
      <button onClick={() => setCameraPose('perspective')}>Общий</button>
      <button onClick={() => setCameraPose('front')}>Фасад</button>
      <button onClick={() => setCameraPose('rear')}>Со склона</button>
      <button onClick={() => setCameraPose('side')}>Сбоку</button>
      <button onClick={() => { setDetailRoom(null);setCameraPose('floor'); setPresentation('section'); setView('one'); setArrangement('assembled'); setLabels(true) }}>Внутри этажа ↗</button>
    </div>
    <div className="model-viewport" ref={mount} aria-label="Интерактивная 3D модель этажей Villa Como: перетаскивайте для вращения, колесо мыши для масштаба">
      {error && <div className="model-error" role="alert">{error}<button onClick={() => setError(null)}>Закрыть</button></div>}
      <div className="model-overlay">
        <span className="model-eyebrow">{presentation === 'exterior' ? 'VILLA COMO / SMART HOME' : 'MÈTRE / SOURCE-BASED 3D'}</span>
        <b>{detailRoom===12&&!viewAll&&presentation!=='exterior'?'КУХНЯ · ВТОРОЙ ЭТАЖ':viewAll ? 'ВИЛЛА · ГАРАЖ · ДВОР' : floorId === 'garage' ? 'ГАРАЖ' : floorId === 'level-1' ? 'ПЕРВЫЙ ЭТАЖ' : floorId === 'level-2' ? 'ВТОРОЙ ЭТАЖ' : 'ТРЕТИЙ ЭТАЖ'}</b>
        <small>{detailRoom===12&&!viewAll&&presentation!=='exterior'?'Меблировка · A-118 / A-119':presentation === 'exterior' ? viewAll ? 'Общая кровля · жилой и неиспользуемый чердак' : 'План выбранного этажа' : presentation === 'section' ? `${plans[floorId].rooms.length} помещений · стены 55 см` : `${spatial.floors[floorId].wallPolygonCount} стен · ${architecture.floors[floorId].doors.length} дверей`}</small>
        {selectedRoom !== null && presentation !== 'exterior' && <span className="model-selection">{selectedRoom} · {plans[floorId].rooms.find(room => room.number === selectedRoom)?.name}</span>}
      </div>
      <div className="model-gesture-hint">{presentation === 'exterior' ? 'Вращайте · Приближайте · Откройте этаж изнутри' : 'Вращайте · Выбирайте номера помещений'}</div>
      {loadingTexture && <div className="model-loading">Проекция мебели загружается…</div>}
    </div>
    {fallback && <div className="model-renderer-note" role="status">Векторный 3D-просмотр · WebGL недоступен в этом браузере. Материалы и тени упрощены.</div>}
    <div className="model-footnote"><span>{presentation === 'exterior' ? `Внешний контур: ${exteriorConcept.floors[floorId].sourceSheet} · размеры окон A-04–A-06 · рельеф по уточнению владельца` : `Стеновые контуры: ${spatial.floors[floorId].sourceSheet} · мебель: ${plans[floorId].furnitureSheet}`}</span><strong>{presentation === 'exterior' ? 'ЭТАП 3 / 5 · АРХИТЕКТУРА' : 'ПРЕДВАРИТЕЛЬНАЯ 3D · НЕ BIM'}</strong></div>
    <details className="architecture-calibration">
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
      <b>Модель для презентации умного дома.</b> Планы и подписанные габариты окон перенесены из PDF; подоконные отметки, кровля, отделка и профиль склона требуют сверки с фасадами и топосъёмкой. Задняя часть нижнего этажа заглублена по уточнению владельца. Гараж справа, повёрнут к двору; въезд расположен со стороны балкона. Двор, парковка и гараж — на уровне первого этажа. Расстояния на участке — демонстрационные. Мебель и сантехника — упрощённые 3D-модели по планам A-18–A-29. Далее: отделка и световые сценарии.
    </> : <>
      Контуры стен и положения {architecture.floors[floorId].doors.length} дверных полотен перенесены из PDF, размеры дверей — из ведомости {spatial.floors[floorId].sourceSheet}. <b>{architecture.floors[floorId].openingCountResolved} проёмов сопоставлены с просветами на плане, остальные оставлены неразрешёнными.</b> Конструктивная крыша и фасады пока не подтверждены.
    </>}</div>
  </div>
}
