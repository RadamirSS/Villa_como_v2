import {createSecurityObjects,updateSecurityObjects} from './Security3D'
import type {SecurityController} from '../domain/useSecurity'
import type {CameraCapture} from './SecurityControls'
import {virtualCameras} from '../domain/security'
import CourtyardLight from './CourtyardLight'
import { updateSiteTime } from './SiteLandscape'
import i18n, { tx } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import LightingControls from './LightingControls'
import {createLightingLayer,updateLightingVisuals}from './Lighting3D'
import type{LightingController}from '../domain/useLighting'
import {roomIsOn,lightingPlan,lightScenarios}from '../domain/lighting'
import OverlayPanel,{type ShowroomPanel}from './OverlayPanel'
import ShowroomIcon from './ShowroomIcon'
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
  node.setAttribute('aria-label', tx(`Помещение ${value}`))
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

export default function Villa3D({ security, securityCapture, floorId, selectedRoom, onSelectRoom, onChooseFloor, panel, onPanel, lighting, floorSelectionRevision = 0 }: {
  floorId: FloorId
  security:SecurityController
  securityCapture:CameraCapture
  lighting: LightingController
  floorSelectionRevision?: number
  selectedRoom: number | null
  onSelectRoom: (value: number|null) => void
  onChooseFloor: (floor:FloorId)=>void
  panel:ShowroomPanel
  onPanel:(panel:ShowroomPanel)=>void
}) {
  const securityRef=useRef(security.state);securityRef.current=security.state
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
  const lightStateRef=useRef(lighting.state)
  lightStateRef.current=lighting.state
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
  const [, setLoadingTexture] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [site, setSite] = useState(true)
  const snapshotRef=useRef(()=>{})
  const [activePose,setActivePose]=useState('perspective')
  onSelectRef.current = onSelectRoom
  const viewAll = view === 'all'

  useEffect(() => {
    if (!floorSelectionRevision) return
    poseRef.current = 'floor'; setActivePose('floor');setTop(false); setDetailRoom(null)
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
    snapshotRef.current=()=>{
      renderer.render(scene,camera)
      const element=renderer.domElement,link=document.createElement('a')
      if(element instanceof HTMLCanvasElement){link.href=element.toDataURL('image/png');link.download='villa-como.png';link.click()}
      else{const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(element)],{type:'image/svg+xml'}));link.href=url;link.download='villa-como.svg';link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}
    }
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
    key.shadow.camera.left = -45; key.shadow.camera.right = 45
    key.shadow.camera.top = 45; key.shadow.camera.bottom = -45
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
    securityCapture.current=(id)=>{
      const spec=virtualCameras.find(c=>c.id===id);if(!spec)return ''
      const view=new THREE.PerspectiveCamera(65,camera.aspect,.1,150);view.position.set(spec.position[0],spec.position[1],spec.position[2]);view.lookAt(new THREE.Vector3(...spec.target))
      renderer.render(scene,view)
      let result='';try{const element=renderer.domElement;result=element instanceof HTMLCanvasElement?element.toDataURL('image/png'):'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(element))}finally{renderer.render(scene,camera)}
      return result
    }
    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      controls.update()
      if(drawingsRef.current)updateSecurityObjects(drawingsRef.current,securityRef.current)
      if(contextRef.current)updateSecurityObjects(contextRef.current,securityRef.current)
      const access=securityRef.current
      if(access.gate!==(access.gateTarget?1:0)||access.garage!==(access.garageTarget?1:0)||access.carTarget!==null)dirty=true
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
      securityCapture.current=()=>''
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
      updateSiteTime(contextRef.current,lighting.time,lighting.courtyard)
      scene.add(contextRef.current)
    }
    const all = viewAll ? [...floorOrder] : [floorId]
    const root = new THREE.Group()
    drawingsRef.current = root
    scene.add(root)
    if(viewAll&&presentation==='exterior')root.add(createSecurityObjects())
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
            const node=document.createElementNS('http://www.w3.org/2000/svg','text');node.textContent=tx('Неиспользуемый чердак');node.setAttribute('fill','#3d5146');node.setAttribute('font-size','12');node.setAttribute('text-anchor','middle')
            label=new SVGObject(node)
          } else {
            const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80
            const ctx=canvas.getContext('2d')!;ctx.fillStyle='#29433b';ctx.fillRect(0,0,512,80)
            ctx.fillStyle='#f2ecd9';ctx.font='600 28px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tx('Неиспользуемый чердак'),256,40)
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
    const litFloors:FloorId[]=isExterior&&viewAll&&showGarage?[...all,'garage']:all
    for(const id of [...new Set(litFloors)]){
      const layer=createLightingLayer(id,presentation==='section',lighting.wiring,isExterior)
      const [offsetX,offsetZ]=registrationMetres(id)
      layer.position.set(offsetX,viewAll?vertical(id,arrangement):0,offsetZ)
      if(isExterior&&viewAll&&id==='garage'){
        layer.position.set(exteriorConcept.garagePlacement.xyMeters[0],exteriorConcept.garagePlacement.baseM,exteriorConcept.garagePlacement.xyMeters[1])
        layer.rotation.y=exteriorConcept.garagePlacement.rotationToHouseDegrees*Math.PI/180
      }
      if(detailRoom!==null)layer.visible=false
      root.add(layer)
    }
    updateLightingVisuals(root,lightStateRef.current)
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
    if (isExterior && viewAll && site) boundsRef.current.expandByPoint(new THREE.Vector3(40,0,42))
    const fitKey = `${floorId}-${viewAll}-${arrangement}-${presentation}-${detailRoom}`
    if (fitKeyRef.current !== fitKey) { fitKeyRef.current = fitKey; fitCameraRef.current() }
    invalidateRef.current()

  }, [floorId, viewAll, arrangement, furniture, walls, doors, labels, presentation, roof, glazing, terrace, site, fallback, showGarage, detailRoom, lighting.wiring, i18n.resolvedLanguage])

  useEffect(()=>{
    if(drawingsRef.current){
      updateLightingVisuals(drawingsRef.current,lighting.state)
      drawingsRef.current.traverse(obj=>{
        if(obj instanceof SVGObject&&Number.isInteger(obj.userData.roomNumber)){
          const on=roomIsOn(lighting.state,floorId,obj.userData.roomNumber)
          obj.node.querySelector('circle')?.setAttribute('fill',on?'#ffcb61':'#dbc399')
        }
      })
    }
    invalidateRef.current()
  },[lighting.state,floorId,viewAll,presentation,lighting.wiring])

  useEffect(()=>{
    const scene=sceneRef.current;if(!scene)return
    if(contextRef.current)updateSiteTime(contextRef.current,lighting.time,lighting.courtyard)
    scene.background=new THREE.Color(lighting.time==='day'?'#aba995':lighting.time==='dusk'?'#9b9785':'#18272d')
    scene.traverse(obj=>{if(obj instanceof THREE.Light){
      if(obj instanceof THREE.AmbientLight){obj.color.set(fallback?(lighting.time==='day'?'#959b9a':lighting.time==='dusk'?'#677574':'#36474c'):'#ffffff');obj.intensity=lighting.time==='day'?.7:lighting.time==='dusk'?.4:.2}
      else if(obj instanceof THREE.DirectionalLight)obj.intensity=(obj.castShadow?(fallback?.6:2.6):(fallback?.25:.8))*(lighting.time==='day'?1:lighting.time==='dusk'?.5:.2)
      else if(obj instanceof THREE.HemisphereLight)obj.intensity=fallback?0:lighting.time==='day'?1.5:lighting.time==='dusk'?.65:.25
    }})
    invalidateRef.current()
  },[lighting.time,lighting.courtyard,fallback])

  useEffect(() => {
    drawingsRef.current?.traverse(item => {
      if (item instanceof THREE.Sprite && Number.isInteger(item.userData.roomNumber)) {
        const scale = item.userData.roomNumber === selectedRoom ? 1.12 : .78
        item.scale.set(scale, scale, 1)
      }
    })
    invalidateRef.current()
  }, [selectedRoom, floorId, labels, viewAll])

  useEffect(()=>{invalidateRef.current()},[security.state])
  useEffect(()=>{if(panel==='security'){setView('all');setPresentation('exterior');setArrangement('assembled');setSite(true);setShowGarage(true);setDetailRoom(null)}},[panel])

  const setCameraPose = (pose: typeof poseRef.current) => {
    poseRef.current = pose;setActivePose(pose); setTop(pose === 'top'); fitCameraRef.current()
  }
  const resetCamera = (plan: boolean) => setCameraPose(plan ? 'top' : 'perspective')
  const zoomCamera = (factor: number) => {
    const cam = cameraRef.current, target = controlsRef.current?.target
    if (!cam || !target) return
    const vec = cam.position.clone().sub(target).multiplyScalar(factor)
    cam.position.copy(target).add(vec)
    controlsRef.current?.update()
  }

  const chooseAll=()=>{setDetailRoom(null);setView('all');setPresentation('exterior');setArrangement('assembled');onSelectRoom(null);setCameraPose('perspective')}
  const levelTitle=viewAll?'Архитектура':floorId==='garage'?'Гараж':floorId==='level-1'?'1 этаж':floorId==='level-2'?'2 этаж':'3 этаж'
  const room=plans[floorId].rooms.find(r=>r.number===selectedRoom)
  const litRooms=lightingPlan.rooms.filter(r=>roomIsOn(lighting.state,r.floor as FloorId,r.number)).length
  const activeScenario=lightScenarios.find(s=>s.id===lighting.scenario)
  return <div className="showroom-scene" data-time={lighting.time}>
    <div className="showroom-canvas" ref={mount} aria-label={tx("Интерактивная 3D модель Villa Como: вращайте и выбирайте комнаты")}/>
    <div className="showroom-intro"><p><span/> THE ART OF SMART LIVING</p><h1>Villa <em>Como.</em></h1><span>{tx("Архитектура пространства. Интеллект света.")}</span></div>
    <div className="scene-utilities"><button className="icon-button" aria-label={tx("Сбросить ракурс")} title={tx("Сбросить ракурс")} onClick={()=>viewAll?resetCamera(false):setCameraPose('floor')}><ShowroomIcon name="reset"/></button><button className="icon-button" aria-label={tx('Приблизить')} title={tx('Приблизить')} onClick={()=>zoomCamera(.82)}>+</button><button className="icon-button" aria-label={tx('Отдалить')} title={tx('Отдалить')} onClick={()=>zoomCamera(1.22)}>−</button></div>
    <div className="showroom-camera glass-control" role="group" aria-label={tx("Ракурс модели")}>{tx(([['perspective','Объём'],['front','Со двора'],['rear','Сзади'],['top','Сверху']]as const).map(([pose,label])=><button key={pose} aria-pressed={activePose===pose||(pose==='perspective'&&activePose==='floor')} onClick={()=>setCameraPose(pose==='perspective'&&!viewAll?'floor':pose)}>{tx(label)}</button>))}</div>
    {tx(error&&<div className="showroom-error" role="alert">{tx(error)}<button onClick={()=>setError(null)}>{tx("Закрыть")}</button></div>)}
    {tx(!viewAll&&room&&<div className="selected-room-card glass-control"><button className="selected-room-name" onClick={()=>onPanel('rooms')}><span>{tx("КОМНАТА ")}{tx(room.number)}</span><b>{tx(room.name)}</b><small>{tx(roomIsOn(lighting.state,floorId,room.number)?'Свет включён':'Свет выключен')} {tx(" · виды света ↗")}</small></button><button role="switch" aria-checked={roomIsOn(lighting.state,floorId,room.number)} aria-label={tx(`Свет: ${room.name}`)} className="selected-room-power" onClick={()=>lighting.setRoom(floorId,room.number,!roomIsOn(lighting.state,floorId,room.number))}><ShowroomIcon name="light"/></button><button className="room-card-close" aria-label={tx("Снять выбор комнаты")} onClick={()=>onSelectRoom(null)}>×</button></div>)}
    <div className="showroom-time glass-control" role="group" aria-label={tx("Время суток")}>{tx((['day','dusk','night']as const).map((time,i)=><button key={time} aria-pressed={lighting.time===time} onClick={()=>lighting.setTime(time)}><ShowroomIcon name={['sun','dusk','moon'][i]as 'sun'|'dusk'|'moon'}/>{tx(['День','Сумерки','Ночь'][i])}</button>))}</div>
    <span className="visually-hidden" role="status">{tx(activeScenario?`Сценарий: ${activeScenario.name}. `:'')}{tx("Свет включён в ")}{tx(litRooms)} {tx(" комнатах.")} {tx(lighting.courtyard?'Двор: включён':'Двор: выключен')}</span>
    <div className="showroom-dock glass-control"><div className="dock-heading"><span>{tx(levelTitle)}</span><div><button className="primary-model-action" aria-label={tx("Открыть свет в комнатах")} onClick={()=>onPanel('rooms')}><ShowroomIcon name="light"/><span>{tx('Свет')}</span><small>{litRooms+(lighting.courtyard?1:0)}</small></button><button className="primary-model-action" aria-label={tx("Открыть сценарии")} onClick={()=>onPanel('scenarios')}><ShowroomIcon name="scene"/><span>{tx('Сценарии')}</span>{activeScenario&&<i className="preset-dot"/>}</button></div></div>
     <div className="showroom-floors" role="tablist" aria-label={tx("Выбор этажа")} onKeyDown={event=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'));const index=tabs.indexOf(document.activeElement as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next]?.focus();tabs[next]?.click()}}><button role="tab" aria-selected={viewAll} onClick={chooseAll}><span aria-hidden="true">▦</span> <span className="overview-label">{tx('Весь участок')}</span></button>{tx((['level-2','level-1','level-3','garage']as const).map(id=><button role="tab" aria-label={tx(id==='garage'?'Гараж':id==='level-1'?'1 этаж':id==='level-2'?'2 этаж':'3 этаж')} aria-selected={!viewAll&&floorId===id} key={id} onClick={()=>onChooseFloor(id)}><span aria-hidden="true">{tx(id==='garage'?'▱':id==='level-1'?'1':id==='level-2'?'2':'3')}</span>{tx(id==='garage'?'Гараж':'этаж')}</button>))}</div>
    </div>
    {tx((!viewAll&&!room)&&<p className="showroom-hint">{tx("Выберите комнату на модели, чтобы управлять светом")}</p>)}
    {tx((panel==='view'||panel==='scenarios'||panel==='rooms')&&<OverlayPanel title={tx(panel==='view'?'Настройки вида':panel==='scenarios'?'Сценарии':'Свет')} onClose={()=>onPanel(null)}>
      {tx(panel==='view'?<div className="view-settings"><p className="panel-intro">{tx("Настройте отображение под свою задачу.")}</p>
       <h3>{tx("Модель")}</h3><div className="setting-modes"><button className="panel-secondary" onClick={()=>{chooseAll();onPanel(null)}}>{tx("Дом и участок")}</button><button className="panel-secondary" onClick={()=>{setDetailRoom(null);setView('one');setPresentation('section');setCameraPose('floor');onPanel(null)}}>{tx("Низкие стены")}</button><button className="panel-secondary" onClick={()=>{setDetailRoom(null);setView('one');setPresentation('source');onPanel(null)}}>{tx("Полные стены")}</button><button className="panel-secondary" onClick={()=>{setDetailRoom(null);setView('all');setPresentation('section');setArrangement(v=>v==='assembled'?'exploded':'assembled');onPanel(null)}}>{tx(arrangement==='exploded'?'Собрать этажи':'Раздвинуть этажи')}</button></div>
       <h3>{tx("Показывать")}</h3><div className="setting-toggles">{tx((presentation==='exterior'?[[showGarage,setShowGarage,'Гараж на участке'],[roof,setRoof,'Кровлю'],[glazing,setGlazing,'Остекление'],[site,setSite,'Участок'],[terrace,setTerrace,'Террасу']]:[[walls,setWalls,'Стены'],[doors,setDoors,'Двери'],[furniture,setFurniture,'Мебель и сантехнику'],[labels,setLabels,'Номера комнат']]).map(([value,setter,label])=><label key={label as string}><span>{tx(label as string)}</span><input type="checkbox" checked={value as boolean} onChange={e=>(setter as (v:boolean)=>void)(e.target.checked)}/></label>))}<label><span>{tx("Условные связи групп света")}</span><input type="checkbox" checked={lighting.wiring} onChange={e=>lighting.setWiring(e.target.checked)}/></label></div>
       {tx(floorId==='level-2'&&<button className="panel-secondary full-width" onClick={()=>{poseRef.current='kitchen';setActivePose('kitchen');setDetailRoom(12);setFurniture(true);setView('one');setPresentation('section');setLabels(false);onSelectRoom(12);onPanel(null)}}>{tx("Рассмотреть кухню крупно ↗")}</button>)}
       <details className="panel-details"><summary>{tx('Как пользоваться моделью')}</summary><p>{tx('Выберите этаж, затем комнату. Кнопка света управляет всей комнатой, название открывает виды освещения. Вращайте одним пальцем, двумя — приближайте. Кнопка «Весь участок» возвращает общий вид.')}</p></details><button className="panel-secondary full-width" onClick={()=>snapshotRef.current()}>{tx('Сохранить вид модели')}</button><details className="panel-details"><summary>{tx("Масштаб и дополнительные ракурсы")}</summary><div className="setting-modes"><button className="panel-secondary" onClick={()=>zoomCamera(1.22)}>{tx("Отдалить")}</button><button className="panel-secondary" onClick={()=>zoomCamera(.82)}>{tx("Приблизить")}</button><button className="panel-secondary" onClick={()=>setCameraPose('side')}>{tx("Сбоку")}</button><button className="panel-secondary" onClick={()=>resetCamera(!top)}>{tx(top?'Изометрия':'Сверху')}</button></div></details>
       <details className="panel-details"><summary>{tx("О просмотре и источниках")}</summary><p>{tx(fallback?'В этом браузере WebGL недоступен. Используется векторный 3D-просмотр с упрощёнными материалами и тенями.':'Используется WebGL-просмотр модели.')}</p><p>{tx("Стены: ")}{tx(spatial.floors[floorId].sourceSheet)}{tx("; мебель: ")}{tx(plans[floorId].furnitureSheet)}{tx(". Условные линии связывают группы света и не являются кабельными трассами. Точность и исходные данные — в паспорте модели.")}</p></details>
      </div>:<>{tx(panel==='rooms'&&<><CourtyardLight lighting={lighting} onShow={()=>{setSite(true);chooseAll();onPanel(null)}}/><label className="panel-floor-select">{tx("Уровень")}<select value={floorId} onChange={e=>onChooseFloor(e.target.value as FloorId)}>{tx((['level-1','level-2','level-3','garage']as const).map(id=><option key={id} value={id}>{tx(id==='garage'?'Гараж':id==='level-1'?'1 этаж':id==='level-2'?'2 этаж':'3 этаж')}</option>))}</select></label></>)}<LightingControls floor={floorId} room={selectedRoom} onRoom={n=>{onSelectRoom(n);if(viewAll){setView('one');setPresentation('section');setCameraPose('floor')}}} lighting={lighting} mode={panel} onApplied={()=>onPanel(null)}/></>)}
    </OverlayPanel>)}
  </div>
}
