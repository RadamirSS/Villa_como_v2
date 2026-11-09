import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createSiteLandscape } from './SiteLandscape'
import raw from '../data/exterior-concept.json'
import { roomForWindow } from '../domain/lighting'

export type FloorId = 'garage' | 'level-1' | 'level-2' | 'level-3'
type Point = [number, number]
type Polygon = { outer: Point[]; holes: Point[][] }
type Opening = { id: string; at: number; widthM: number; sillM: number; heightM: number; curvedPanel?: boolean; kind?: string; sourceLabel: string }
type Segment = { id: string; fromPt: Point; toPt: Point; lengthM: number; earthContact: boolean; windows: Opening[] }
type FacadeFloor = { sourceSheet: string; baseM: number; displayWallHeightM: number; registrationOffsetPt: Point; outlinePt: Point[]; facadeSegments: Segment[]; windowsApproxCount: number; floorPlatePt?: Polygon[]; slabBaseM?: number; slabThicknessM?: number }
type ExteriorData = {
  pointsPerMeter: number; originPt: { xPt: number; yPt: number }
  floors: Record<FloorId, FacadeFloor>
  roof: { eaveM: number; faces: { id: string; outlinePt: Point[]; plane: [number, number, number] }[]; boundaryPt: Point[];
    unusedAtticPt: Polygon[]; coverage: string; lowRoofs: { id: string; polygonPt: Polygon; heightM: number }[];
    skylights: { id: string; centrePt: Point; widthM: number; heightM: number }[] }
  garagePlacement: { xyMeters: Point; pivotPt: Point; baseM: number; rotationToHouseDegrees: number }
  terrace: { polygonPt: Point[]; elevationM: number; balustradeHeightM: number; scheduleAreaM2: number }
  garageAppendix: { outlinePt: Point[]; heightM: number }
  site: { trianglesPtM: [number, number, number][][]; boundaryPt: Point[]; pavingPt: Polygon[]; rearGradeM: number; frontGradeM: number }
}
export const exteriorConcept = raw as unknown as ExteriorData
const ppm = exteriorConcept.pointsPerMeter
const origin = exteriorConcept.originPt
const px = (n: number) => (n - origin.xPt) / ppm
const pz = (n: number) => (n - origin.yPt) / ppm
const point = (p: Point, y = 0) => new THREE.Vector3(px(p[0]), y, pz(p[1]))
export const registrationMetres = (id: FloorId) => exteriorConcept.floors[id].registrationOffsetPt.map(n => n / ppm) as Point

function palette() {
  return {
    plaster: new THREE.MeshStandardMaterial({ color: '#e9e1d2', roughness: .88 }),
    stone: new THREE.MeshStandardMaterial({ color: '#c8bdab', roughness: .94 }),
    edge: new THREE.MeshStandardMaterial({ color: '#dfd7c9', roughness: .82 }),
    frame: new THREE.MeshStandardMaterial({ color: '#383e39', roughness: .42, metalness: .55 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#88a9a5', roughness: .16, metalness: .12, transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false }),
    interior: new THREE.MeshStandardMaterial({ color: '#5b625b', roughness: .94 }),
    roof: new THREE.MeshStandardMaterial({ color: '#8b6654', roughness: .92, metalness: .04, side: THREE.DoubleSide }),
    flat: new THREE.MeshStandardMaterial({ color: '#b0b1a5', roughness: .96 }),
  }
}
type Palette = ReturnType<typeof palette>
function shape(poly: Polygon) {
  const trace = (path: THREE.Path, pts: Point[]) => {
    pts.forEach((p, i) => i ? path.lineTo(px(p[0]), -pz(p[1])) : path.moveTo(px(p[0]), -pz(p[1])))
    path.closePath()
  }
  const s = new THREE.Shape(); trace(s, poly.outer)
  for (const pts of poly.holes) { const h = new THREE.Path(); trace(h, pts); s.holes.push(h) }
  return s
}
function slab(poly: Polygon | Point[], base: number, thickness: number, material: THREE.Material) {
  const geometry = new THREE.ExtrudeGeometry(shape(Array.isArray(poly) ? { outer: poly, holes: [] } : poly), { depth: thickness, bevelEnabled: false, steps: 1 })
  geometry.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = base; mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}
function beam(a: THREE.Vector3, b: THREE.Vector3, depth: number, height: number, base: number, material: THREE.Material) {
  const d = b.clone().sub(a)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), height, depth), material)
  mesh.position.copy(a).lerp(b, .5); mesh.position.y = base + height / 2
  mesh.rotation.y = -Math.atan2(d.z, d.x)
  mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}
function area(pts: Point[]) { return pts.reduce((sum, p, i) => { const q = pts[(i + 1) % pts.length]; return sum + p[0] * q[1] - q[0] * p[1] }, 0) / 2 }

function glazing(a: THREE.Vector3, b: THREE.Vector3, sill: number, opening: Opening, outside: THREE.Vector3, p: Palette, visible: boolean, floorId: FloorId) {
  const g = new THREE.Group(); g.name = opening.id
  g.userData = { openingId: opening.id, sourceLabel: opening.sourceLabel, lightingBinding: null }
  const width = a.distanceTo(b), height = opening.heightM
  const inset = outside.clone().multiplyScalar(-.035)
  const start = a.clone().add(inset), end = b.clone().add(inset)
  if (opening.kind === 'shutter') {
    g.add(beam(start, end, .09, height, sill, p.frame))
    for (let h = .08; h < height; h += .16) g.add(beam(start, end, .095, .012, sill + h, p.roof))
    if(floorId==='garage'){
      // Visual light spilling at a closed garage threshold, not a fictitious glazed door.
      const glow=new THREE.MeshBasicMaterial({color:'#ffc364',transparent:true,opacity:.45,depthWrite:false})
      const spill=beam(a.clone().addScaledVector(outside,.7),b.clone().addScaledVector(outside,.7),1.3,.012,.012,glow)
      spill.castShadow=false;spill.userData={lightRole:'exterior-spill',lightingFloor:'garage',roomNumber:1,visualizationOnly:true};g.add(spill)
    }
    return g
  }
  if (visible) {
    const glass = beam(start, end, .018, height, sill, p.glass.clone())
    glass.castShadow = false; glass.userData = { openingId: opening.id, smartHomeTarget: true, lightingRoomKey:roomForWindow(floorId,[(a.x+b.x)/2*ppm+origin.xPt,(a.z+b.z)/2*ppm+origin.yPt],[-outside.x,-outside.z]), bindingEvidence:'nearest-inward-source-room' }
    g.add(glass)
    // Recessed neutral interior, so an empty envelope does not look transparent through two facades.
    const back = outside.clone().multiplyScalar(-.30)
    g.add(beam(a.clone().add(back), b.clone().add(back), .02, height, sill, p.interior))
  }
  // Slim rectangular joinery. Bay glazing uses continuous curved rails, no thick
  // vertical frame on every tiny tessellation edge.
  for (const h of [0, height - .045]) g.add(beam(start, end, .07, .045, sill + h, p.frame))
  if (!opening.curvedPanel) {
    for (const t of width > 1.3 ? [0, .5, 1] : [0, 1]) {
      const pos = start.clone().lerp(end, t)
      const m = new THREE.Mesh(new THREE.BoxGeometry(.045, height, .07), p.frame)
      m.position.set(pos.x, sill + height / 2, pos.z); m.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x)
      g.add(m)
    }
  }
  if (opening.sillM > .2 && !opening.curvedPanel) g.add(beam(a, b, .34, .055, sill - .04, p.edge))
  return g
}
function facade(id: FloorId, individual: boolean, glass: boolean, p: Palette) {
  const f = exteriorConcept.floors[id], g = new THREE.Group()
  const base = individual ? 0 : f.baseM
  const sign = area(f.outlinePt) > 0 ? 1 : -1
  for (const edge of f.facadeSegments) {
    const a = point(edge.fromPt), b = point(edge.toPt)
    const length = a.distanceTo(b), dir = b.clone().sub(a).normalize()
    const outside = new THREE.Vector3(dir.z * sign, 0, -dir.x * sign)
    const at = (n: number) => a.clone().addScaledVector(dir, n)
    const wall = (left: number, right: number, y: number, h: number) => {
      if (right - left < .0001 || h < .0001) return
      const join = edge.lengthM < .6 ? .018 : .001
      const m = beam(at(left - join), at(right + join), .28, h, y, p.plaster)
      m.userData = { facadeEdgeId: edge.id, floorId: id, earthContact: edge.earthContact }
      g.add(m)
    }
    let cursor = 0
    for (const w of edge.windows) {
      const left = Math.max(0, w.at * length - w.widthM / 2), right = Math.min(length, left + w.widthM)
      wall(cursor, left, base, f.displayWallHeightM)
      wall(left, right, base, w.sillM)
      wall(left, right, base + w.sillM + w.heightM, f.displayWallHeightM - w.sillM - w.heightM)
      g.add(glazing(at(left), at(right), base + w.sillM, w, outside, p, glass, id))
      cursor = right
    }
    wall(cursor, length, base, f.displayWallHeightM)
    // Restrained stone plinth meets the floor; never an open band under a wall.
    g.add(beam(a, b, .31, .12, base - .12, p.stone))
  }
  if (!individual && f.floorPlatePt) {
    for (const polygon of f.floorPlatePt) g.add(slab(polygon, f.slabBaseM!, f.slabThicknessM!, p.edge))
  } else g.add(slab(f.outlinePt, base - .22, .22, p.edge))
  const [x, z] = registrationMetres(id); g.position.set(x, 0, z)
  g.userData = { facadeFloor: id, sourceSheet: f.sourceSheet }; return g
}
function containsPoint(pts: Point[], p: Point) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if ((pts[i][1] > p[1]) !== (pts[j][1] > p[1]) && p[0] < (pts[j][0] - pts[i][0]) * (p[1] - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) inside = !inside
  }
  return inside
}
function roofHeight(p: Point) {
  const face = exteriorConcept.roof.faces.find(f => containsPoint(f.outlinePt, p))
  if (!face) return exteriorConcept.roof.eaveM
  const [a,b,c] = face.plane
  return a*p[0] + b*p[1] + c
}
function roofGroup(p: Palette, glass: boolean) {
  const g = new THREE.Group(); g.name = 'continuous-roof'
  for (const face of exteriorConcept.roof.faces) {
    const poly = face.outlinePt.map(pt => new THREE.Vector2(px(pt[0]), pz(pt[1])))
    const triangles = THREE.ShapeUtils.triangulateShape(poly, [])
    const positions: number[] = []
    const [a, b, c] = face.plane
    for (const t of triangles) for (const i of [...t].reverse()) {
      const pt = face.outlinePt[i]; positions.push(px(pt[0]), a * pt[0] + b * pt[1] + c, pz(pt[1]))
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals()
    const m = new THREE.Mesh(geometry, p.roof); m.castShadow = true; m.receiveShadow = true
    m.userData = { roofFace: face.id, provisional: true }; g.add(m)
    // Fine seams on actual clipped roof faces, no disconnected gable triangles.
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), new THREE.LineBasicMaterial({ color: '#3b4541', transparent: true, opacity: .5 }))
    g.add(edge)
  }
  const outline = exteriorConcept.roof.boundaryPt
  outline.forEach((pt, i) => g.add(beam(point(pt), point(outline[(i + 1) % outline.length]), .12, .16, exteriorConcept.roof.eaveM - .16, p.frame)))
  for (const r of exteriorConcept.roof.skylights) {
    const [x, z] = r.centrePt
    const spanX = r.widthM * ppm / 2, spanZ = r.heightM * ppm / 2
    const vertices: Point[] = [[x - spanX, z - spanZ], [x + spanX, z - spanZ], [x + spanX, z + spanZ], [x - spanX, z + spanZ]]
    const centreFace = exteriorConcept.roof.faces.find(face => containsPoint(face.outlinePt, [x,z]))
    const [slopeX, slopeZ] = centreFace?.plane ?? [0, 0, 0]
    const plane = (v: Point) => roofHeight([x,z]) + slopeX * (v[0]-x) + slopeZ * (v[1]-z)
    // A real planar pane on a flashing curb, even at an inferred roof hip.
    // Sampling four roof heights directly creates a twisted quadrilateral.
    const lift = Math.max(...vertices.map(v => roofHeight(v) + .085 - plane(v)))
    const paneHeight = (v: Point) => plane(v) + lift
    const coords = [0, 2, 1, 0, 3, 2].flatMap(i => { const v = vertices[i]; return [px(v[0]), paneHeight(v), pz(v[1])] })
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3)); geometry.computeVertexNormals()
    const m = new THREE.Mesh(geometry, glass ? p.glass.clone() : p.frame); m.userData = { skylight: r.id, source: 'A-06', lightingRoomKey:glass?roomForWindow('level-3',r.centrePt):null }; g.add(m)
    vertices.forEach((v,i) => {
      const w = vertices[(i+1)%4]
      const points = [point(v,roofHeight(v)),point(w,roofHeight(w)),point(w,paneHeight(w)),point(v,roofHeight(v)),point(w,paneHeight(w)),point(v,paneHeight(v))]
      const geo = new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));geo.computeVertexNormals()
      g.add(new THREE.Mesh(geo,p.roof))
    })
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vertices.map(v => point(v, paneHeight(v) + .01))), new THREE.LineBasicMaterial({ color: '#303a36', linewidth: 2 }))
    g.add(line)
  }
  for (const low of exteriorConcept.roof.lowRoofs) {
    const m = slab(low.polygonPt, low.heightM, .04, p.flat); m.userData.lowRoof = low.id; g.add(m)
  }
  return g
}
function terraceGroup(p: Palette) {
  const t = exteriorConcept.terrace, g = new THREE.Group(); g.name = 'terrace-13'
  g.add(slab(t.polygonPt, t.elevationM + .004, .025, p.stone))
  // Only the open front has a balustrade. The other three edges adjoin rooms.
  const a = point(t.polygonPt[2]), b = point(t.polygonPt[3]), width = a.distanceTo(b)
  const n = Math.ceil(width / 1.3)
  for (let i = 0; i < n; i++) {
    const aa = a.clone().lerp(b, i / n), bb = a.clone().lerp(b, (i + 1) / n)
    const pane = beam(aa, bb, .025, t.balustradeHeightM - .08, t.elevationM + .06, p.glass); pane.castShadow = false; g.add(pane)
    const post = new THREE.Mesh(new THREE.BoxGeometry(.035, t.balustradeHeightM, .035), p.frame)
    post.position.set(aa.x, t.elevationM + t.balustradeHeightM / 2, aa.z); g.add(post)
  }
  g.add(beam(a, b, .055, .04, t.elevationM + t.balustradeHeightM, p.frame))
  // Large-format stone joints, quietly legible instead of a global modelling grid.
  const x0 = t.polygonPt[0][0], x1 = t.polygonPt[1][0], z0 = t.polygonPt[0][1], z1 = t.polygonPt[2][1]
  const joint = new THREE.MeshStandardMaterial({ color: '#a89e8c', roughness: 1 })
  for (let x = x0 + 36; x < x1; x += 36) g.add(beam(point([x, z0]), point([x, z1]), .009, .006, t.elevationM + .030, joint))
  return g
}

/** Keep glazing individually addressable for stage 5; batch static masonry and
 * joinery by shared material to avoid hundreds of draw calls on a phone. */
function batchOpaque(root: THREE.Group) {
  root.updateMatrixWorld(true)
  const buckets = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; parts: object[] }>()
  const meshes: THREE.Mesh[] = []
  root.traverse(obj => { if (obj instanceof THREE.Mesh && !Array.isArray(obj.material) && !obj.material.transparent) meshes.push(obj) })
  for (const m of meshes) {
    const material = m.material as THREE.Material
    let bucket = buckets.get(material)
    if (!bucket) { bucket = { geometries: [], parts: [] }; buckets.set(material, bucket) }
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
    geo.applyMatrix4(m.matrixWorld); geo.deleteAttribute('uv')
    bucket.geometries.push(geo); bucket.parts.push({ name: m.name, ...m.userData })
    m.removeFromParent(); m.geometry.dispose()
  }
  for (const [material, bucket] of buckets) {
    const geometry = mergeGeometries(bucket.geometries, false)
    for (const geo of bucket.geometries) geo.dispose()
    if (!geometry) throw new Error('Cannot batch exterior geometry')
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true; mesh.receiveShadow = true
    mesh.userData = { staticBatch: true, parts: bucket.parts }
    root.add(mesh)
  }
}

export function createExteriorConcept(opts: { floors: FloorId[]; roof: boolean; windows: boolean; terrace: boolean; garage: boolean; assembled: boolean; batch?: boolean }) {
  const g = new THREE.Group(), p = palette(), individual = opts.floors.length === 1
  for (const id of opts.floors) {
    if (id === 'level-3' && !individual) {
      // The A-06 living plan is a subset of the attic, not a raised facade box.
      const f = exteriorConcept.floors[id], deck = new THREE.Group()
      for (const poly of f.floorPlatePt ?? []) deck.add(slab(poly,f.slabBaseM!,f.slabThicknessM!,p.edge))
      const [x,z] = registrationMetres(id); deck.position.set(x,0,z); g.add(deck)
    } else g.add(facade(id, individual, opts.windows, p))
  }
  if (opts.floors.includes('garage')) {
    const pts = exteriorConcept.garageAppendix.outlinePt
    pts.forEach((pt, i) => g.add(beam(point(pt), point(pts[(i + 1) % pts.length]), .28, 2.65, 0, p.plaster)))
    if (opts.roof) {
      g.add(slab(exteriorConcept.floors.garage.outlinePt, 2.65, .20, p.flat))
      g.add(slab(pts, 2.65, .20, p.flat))
    }
  } else {
    if (opts.roof && opts.assembled && opts.floors.includes('level-3')) {
      g.add(roofGroup(p, opts.windows))
      // Close the knee wall below the common roof, including the unused right attic.
      const outline = exteriorConcept.floors['level-2'].outlinePt
      const material = p.plaster.clone(); material.side = THREE.DoubleSide
      const positions:number[]=[]
      outline.forEach((a,i) => {
        const b=outline[(i+1)%outline.length], count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/ppm/.22)
        for(let j=0;j<count;j++){
          const aa:Point=[THREE.MathUtils.lerp(a[0],b[0],j/count),THREE.MathUtils.lerp(a[1],b[1],j/count)]
          const bb:Point=[THREE.MathUtils.lerp(a[0],b[0],(j+1)/count),THREE.MathUtils.lerp(a[1],b[1],(j+1)/count)]
          const lowerA=point(aa,5.9),lowerB=point(bb,5.9),upperA=point(aa,roofHeight(aa)-.025),upperB=point(bb,roofHeight(bb)-.025)
          positions.push(...[lowerA,lowerB,upperB,lowerA,upperB,upperA].flatMap(v=>v.toArray()))
        }
      })
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals()
      const wall=new THREE.Mesh(geo,material);wall.castShadow=true;wall.userData={atticKneeWall:true};g.add(wall)
    }
    if (opts.garage && opts.assembled && opts.floors.includes('level-2')) g.add(createPlacedGarage(opts.roof, opts.windows))
    if (opts.terrace && opts.assembled && opts.floors.includes('level-2')) g.add(terraceGroup(p))
  }
  if (opts.batch !== false) batchOpaque(g)
  g.userData = { visualization: 'source-informed-client-presentation', constructionApproved: false }
  return g
}


/** Owner-confirmed side/orientation, v1 demonstration spacing, not survey coordinates. */
export function createPlacedGarage(roof = true, windows = true) {
  const data=exteriorConcept.garagePlacement
  const local=createExteriorConcept({floors:['garage'],roof,windows,terrace:false,garage:false,assembled:false,batch:false})
  local.position.set(-px(data.pivotPt[0]),0,-pz(data.pivotPt[1]))
  const placed=new THREE.Group();placed.name='site-garage';placed.add(local)
  placed.rotation.y=THREE.MathUtils.degToRad(data.rotationToHouseDegrees)
  placed.position.set(data.xyMeters[0],data.baseM,data.xyMeters[1])
  placed.userData={buildingId:'garage',placement:'owner-informed-demonstration'}
  return placed
}

export function createUnusedAttic() {
  const g=new THREE.Group();g.name='unused-attic'
  const m=new THREE.MeshStandardMaterial({color:'#aab2a8',roughness:1,side:THREE.DoubleSide})
  for(const p of exteriorConcept.roof.unusedAtticPt)g.add(slab(p,.005,.025,m))
  g.userData={spaceKind:'unused-attic',notHabitableRoom:true};return g
}

export function createExteriorContext(garage = false): THREE.Group {
  const g = new THREE.Group(); g.name = 'sloped-site'
  const grass = new THREE.MeshStandardMaterial({ color: '#82906f', roughness: 1, side: THREE.DoubleSide })
  const coords = garage
    ? [-30,-.23,-24, 30,-.23,-24, 30,-.23,24, -30,-.23,-24, 30,-.23,24, -30,-.23,24]
    : exteriorConcept.site.trianglesPtM.flatMap(t => t.flatMap(([x, y, z]) => [px(x), y, pz(z)]))
  const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3)); geom.computeVertexNormals()
  const normals = geom.getAttribute('normal'), positions = geom.getAttribute('position')
  for (let i = 0; i < positions.count; i += 3) if (normals.getY(i) < 0) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, i + 1), b = new THREE.Vector3().fromBufferAttribute(positions, i + 2)
    positions.setXYZ(i + 1, b.x, b.y, b.z); positions.setXYZ(i + 2, a.x, a.y, a.z)
  }
  geom.computeVertexNormals()
  const terrain = new THREE.Mesh(geom, grass); terrain.receiveShadow = true; terrain.name = 'terrain-outside-footprint'; g.add(terrain)
  if (!garage) {
    const earth = new THREE.MeshStandardMaterial({ color: '#84776a', roughness: 1, side: THREE.DoubleSide })
    const boundary = exteriorConcept.site.boundaryPt
    const grade = (p: Point) => { const t = THREE.MathUtils.clamp((p[1] - 142.6) / (423.24 - 142.6), 0, 1); return 2.90 - 3.12 * t * t * (3 - 2 * t) }
    // A continuous site cut on the outside perimeter. The house is subtracted
    // from the top triangulation, so earth never appears through the rooms.
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], b = boundary[(i + 1) % boundary.length]
      const steps = 24
      for (let j = 0; j < steps; j++) {
        const c: Point = [THREE.MathUtils.lerp(a[0], b[0], j / steps), THREE.MathUtils.lerp(a[1], b[1], j / steps)]
        const d: Point = [THREE.MathUtils.lerp(a[0], b[0], (j + 1) / steps), THREE.MathUtils.lerp(a[1], b[1], (j + 1) / steps)]
        const positions = [point(c, -1.1), point(d, -1.1), point(d, grade(d)), point(c, -1.1), point(d, grade(d)), point(c, grade(c))].flatMap(v => v.toArray())
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.computeVertexNormals()
        g.add(new THREE.Mesh(geo, earth))
      }
    }
    g.add(createSiteLandscape())
  }
  batchOpaque(g)
  g.userData = { siteProfile: 'owner-confirmed-rear-at-level-2', surveyed: false }; return g
}
