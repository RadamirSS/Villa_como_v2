import * as THREE from 'three'
import conceptRaw from '../data/exterior-concept.json'

/**
 * Stage 3.5 B: spatially registered *visual exterior concept*.
 * The original PDF has floor plans, but no confirmed elevations/sections/roof.
 * Do not interpret invented facade/window/roof dimensions as BIM source data.
 */
type FloorId = 'garage' | 'level-1' | 'level-2' | 'level-3'
type Point = [number, number]
type Opening = { id: string; at: number; widthM: number; sillM: number; heightM: number; status: string }
type Segment = { id: string; fromPt: Point; toPt: Point; lengthM: number; windows: Opening[] }
type FacadeFloor = {
  status: string; sourceSheet: string; baseM: number; displayWallHeightM: number
  outlinePt: Point[]; facadeSegments: Segment[]; windowsApproxCount: number
}
type Rect = Point[]
type RoofWing = { id: string; rectPt: Rect; eaveYMetres: number; ridgeRiseM: number; overhangM: number; ridgeDirection: 'x' }
type LowRoof = { id: string; outlinePt: Point[]; heightM: number }
type ExteriorData = {
  schema: string; pointsPerMeter: number; originPt: { xPt: number; yPt: number }
  isApprovedArchitecturalModel: boolean
  floors: Record<FloorId, FacadeFloor>
  garageAppendix: { outlinePt: Point[]; heightM: number }
  garagePlacement: { xyMeters: null; onSitePositionApproved: false }
  roof: { status: string; gableWings: RoofWing[]; lowRoofs: LowRoof[] }
  terrace: { polygonPt: Point[]; elevationM: number; balustradeHeightM: number; scheduleAreaM2: number; confirmedPosition: boolean }
}
export const exteriorConcept = conceptRaw as ExteriorData
const perMeter = exteriorConcept.pointsPerMeter
const origin = exteriorConcept.originPt
const px = (value: number) => (value - origin.xPt) / perMeter
const pz = (value: number) => (value - origin.yPt) / perMeter
const point3 = (pt: Point, y = 0) => new THREE.Vector3(px(pt[0]), y, pz(pt[1]))

function mStone() { return new THREE.MeshStandardMaterial({ color: '#dacaba', roughness: .87, metalness: .015, side: THREE.DoubleSide }) }
function mStoneAlt() { return new THREE.MeshStandardMaterial({ color: '#b9ae9e', roughness: .92, metalness: .018, side: THREE.DoubleSide }) }
function mBronze() { return new THREE.MeshStandardMaterial({ color: '#4a4942', metalness: .75, roughness: .32 }) }
function mGlass() { return new THREE.MeshPhysicalMaterial({ color: '#83b4bd', metalness: .12, roughness: .13, transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false, clearcoat: .92, clearcoatRoughness: .08 }) }
function mRoof() { return new THREE.MeshStandardMaterial({ color: '#4b5554', roughness: .59, metalness: .38, side: THREE.DoubleSide }) }
function mRooftop() { return new THREE.MeshStandardMaterial({ color: '#68706e', roughness: .68, metalness: .18, side: THREE.DoubleSide }) }

function signedArea(points: Point[]) {
  let a = 0
  points.forEach((p, i) => { const q = points[(i + 1) % points.length]; a += p[0] * q[1] - q[0] * p[1] })
  return a / 2
}
function between(a: THREE.Vector3, b: THREE.Vector3, thickness: number, height: number, material: THREE.Material, y: number) {
  const length = a.distanceTo(b)
  if (length < .035 || height <= 0) return null
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), material)
  mesh.position.copy(a.clone().add(b).multiplyScalar(.5))
  mesh.position.y = y + height / 2
  mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x)
  mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}
function lineBeam(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const delta = b.clone().sub(a)
  if (delta.length() < .03) return
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material)
  mesh.position.copy(a.clone().add(b).multiplyScalar(.5))
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
  group.add(mesh)
}
function shapeFromOutline(points: Point[]): THREE.Shape {
  const shape = new THREE.Shape()
  points.forEach((p, i) => { if (!i) shape.moveTo(px(p[0]), -pz(p[1])); else shape.lineTo(px(p[0]), -pz(p[1])) })
  shape.closePath()
  return shape
}
function slabMesh(points: Point[], y: number, thickness: number, material: THREE.Material) {
  const geo = new THREE.ExtrudeGeometry(shapeFromOutline(points), { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 8 })
  geo.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.y = y
  mesh.receiveShadow = true
  return mesh
}
function windowUnit(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, y: number,
  width: number, height: number, stone: THREE.Material, bronze: THREE.Material, glass: THREE.Material,
  outside: THREE.Vector3, id: string, showGlazing: boolean) {
  // Light stone reveals, charcoal metal mullions and transparent blue/green glass.
  const push = outside.clone().multiplyScalar(.07)
  const a0 = a.clone().add(push), b0 = b.clone().add(push)
  const panel = between(a0, b0, .034, height, glass, y)
  if (panel && showGlazing) { panel.castShadow = false; panel.renderOrder = 7; panel.userData = { facadeOpening: id, conceptOnly: true }; group.add(panel) } else panel?.geometry.dispose()
  const frameThickness = .055
  const frameHeight = .07
  for (const t of [0, 1, width > 1.5 ? .5 : -1]) {
    if (t < 0) continue
    const p = a0.clone().lerp(b0, t)
    const v = new THREE.Vector3(p.x, y, p.z), v2 = new THREE.Vector3(p.x, y + height, p.z)
    lineBeam(group, v, v2, frameThickness / 2, bronze)
  }
  for (const fraction of [0, 1]) {
    const start = a0.clone(); start.y = y + fraction * height
    const end = b0.clone(); end.y = y + fraction * height
    lineBeam(group, start, end, frameHeight / 2, bronze)
  }
  // Narrow stone surround above/below is actually solid masonry; the reveal is illustrative.
  const sill = between(a0, b0, .11, .075, stone, y - .04)
  if (sill) group.add(sill)
}

function facadeRing(floorId: FloorId, palette: { stone: THREE.Material; accent: THREE.Material; bronze: THREE.Material; glass: THREE.Material },
  levelMode: boolean, glazing: boolean) {
  const data = exteriorConcept.floors[floorId]
  const root = new THREE.Group()
  root.userData = { facadeFloor: floorId, status: data.status, originalSheet: data.sourceSheet }
  const positive = signedArea(data.outlinePt) > 0
  data.facadeSegments.forEach((edge, edgeIndex) => {
    const start = point3(edge.fromPt), end = point3(edge.toPt)
    const tangent = end.clone().sub(start); tangent.y = 0
    const span = tangent.length()
    if (span < .04) return
    const dir = tangent.clone().normalize()
    const outside = positive
      ? new THREE.Vector3(dir.z, 0, -dir.x)
      : new THREE.Vector3(-dir.z, 0, dir.x)
    const windows = edge.windows.map(window => ({
      ...window,
      left: Math.max(.12, window.at * span - window.widthM / 2),
      right: Math.min(span - .12, window.at * span + window.widthM / 2),
    })).filter(w => w.right - w.left >= .24).sort((a, b) => a.left - b.left)
    let previous = 0
    const base = levelMode ? 0 : data.baseM
    const stone = floorId === 'level-1' ? palette.stone : palette.accent
    for (const gap of windows) {
      if (gap.left - previous > .075) {
        const wall = between(start.clone().addScaledVector(dir, previous),start.clone().addScaledVector(dir, gap.left),.22,data.displayWallHeightM,stone,base)
        if (wall) groupAdd(root,wall,edge.id)
      }
      const s = start.clone().addScaledVector(dir, gap.left)
      const e = start.clone().addScaledVector(dir, gap.right)
      if (gap.sillM > .04) {
        const sill = between(s,e,.22,gap.sillM,stone,base)
        if (sill) groupAdd(root,sill,edge.id)
      }
      const upper = Math.max(0, data.displayWallHeightM - gap.sillM - gap.heightM)
      if (upper > .05) {
        const head = between(s,e,.22,upper,stone,base+gap.sillM+gap.heightM)
        if (head) groupAdd(root,head,edge.id)
      }
      windowUnit(root,s,e,base + gap.sillM,gap.right-gap.left,gap.heightM,stone,palette.bronze,palette.glass,outside,gap.id,glazing)
      previous = gap.right
    }
    if (span - previous > .075) {
      const remainder = between(start.clone().addScaledVector(dir,previous),end,.22,data.displayWallHeightM,stone,base)
      if (remainder) groupAdd(root,remainder,edge.id)
    }
    // Premium, understated shadow line between floor bands.
    const corniceA = start.clone().addScaledVector(outside,.012);corniceA.y = base + data.displayWallHeightM - .12
    const corniceB = end.clone().addScaledVector(outside,.012);corniceB.y = base + data.displayWallHeightM - .12
    if (edgeIndex % 3 !== 1) lineBeam(root,corniceA,corniceB,.012,palette.bronze)
  })
  return root
}
function groupAdd(group: THREE.Group, mesh: THREE.Mesh, id: string) {
  mesh.userData = { facadeEdgeId: id, confidence: 'inferred-exterior-plan-outline-only' }
  group.add(mesh)
}
function quad(group: THREE.Group, vertices: THREE.Vector3[], material: THREE.Material, name: string) {
  const coords = [0,1,2,0,2,3]
  const positions: number[] = [], uvs: number[] = []
  const uv = [[0,0],[1,0],[1,1],[0,1]]
  coords.forEach(i => { positions.push(vertices[i].x,vertices[i].y,vertices[i].z);uvs.push(uv[i][0],uv[i][1]) })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry,material)
  mesh.castShadow = true; mesh.receiveShadow = true
  mesh.userData = { conceptRoofPart: name, constructionApproved: false }
  group.add(mesh)
}
function gableEnd(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, apex: THREE.Vector3, material: THREE.Material, name: string) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position',new THREE.Float32BufferAttribute([
    a.x,a.y,a.z,b.x,b.y,b.z,apex.x,apex.y,apex.z,
  ],3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo,material)
  mesh.castShadow = true;mesh.userData = {conceptGable:name}
  group.add(mesh)
}
function roofWing(roof: RoofWing, palette: { roof: THREE.Material; bronze: THREE.Material; stone: THREE.Material }) {
  const ring = roof.rectPt.map(point => point3(point))
  const xs = ring.map(p=>p.x), zs=ring.map(p=>p.z)
  const x0=Math.min(...xs)-roof.overhangM,x1=Math.max(...xs)+roof.overhangM
  const z0=Math.min(...zs)-roof.overhangM,z1=Math.max(...zs)+roof.overhangM
  const middle=(z0+z1)/2,eave=roof.eaveYMetres,crest=eave+roof.ridgeRiseM
  const root=new THREE.Group()
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
  quad(root,[v(x0,eave,z0),v(x1,eave,z0),v(x1,crest,middle),v(x0,crest,middle)],palette.roof,roof.id+'-north-slope')
  quad(root,[v(x0,crest,middle),v(x1,crest,middle),v(x1,eave,z1),v(x0,eave,z1)],palette.roof,roof.id+'-south-slope')
  for(const x of [x0,x1]) gableEnd(root,v(x,eave,z0),v(x,eave,z1),v(x,crest,middle),palette.stone,roof.id)
  lineBeam(root,v(x0,crest+.024,middle),v(x1,crest+.024,middle),.033,palette.bronze)
  for(const z of [z0,z1]) lineBeam(root,v(x0,eave,z),v(x1,eave,z),.04,palette.bronze)
  // Standing-seam rhythm, no photo texture dependency.
  const strips=Math.max(3,Math.floor((x1-x0)/.66))
  for(let i=1;i<strips;i++) {
    const x=x0+(x1-x0)*i/strips
    lineBeam(root,v(x,eave+.018,z0),v(x,crest+.02,middle),.009,palette.bronze)
    lineBeam(root,v(x,crest+.02,middle),v(x,eave+.018,z1),.009,palette.bronze)
  }
  root.userData={roofPartId:roof.id,notInOriginalRoofDrawings:true}
  return root
}
function balustrade(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, elevation: number, height: number, glass: THREE.Material, bronze: THREE.Material) {
  const pane=between(a,b,.032,height,glass,elevation)
  if(pane) { pane.castShadow=false; pane.userData.conceptBalustrade=true;group.add(pane) }
  lineBeam(group,new THREE.Vector3(a.x,elevation+height,a.z),new THREE.Vector3(b.x,elevation+height,b.z),.026,bronze)
  for(const t of [0,.5,1]) {
    const point=a.clone().lerp(b,t)
    lineBeam(group,new THREE.Vector3(point.x,elevation,point.z),new THREE.Vector3(point.x,elevation+height,point.z),.027,bronze)
  }
}
function terraceGroup(materials: { stone: THREE.Material; bronze: THREE.Material; glass: THREE.Material }) {
  const terrace=exteriorConcept.terrace
  const g=new THREE.Group()
  const t=slabMesh(terrace.polygonPt,terrace.elevationM-.16,.13,materials.stone)
  t.userData={sourceRoom:13,level:'level-2',confirmedPosition:false}
  g.add(t)
  // Balcony fronts on the 3 outward edges of the source plan recess.
  const lines=[0,1,2]
  lines.forEach(i=>{
    const a=point3(terrace.polygonPt[i]),b=point3(terrace.polygonPt[i+1])
    balustrade(g,a,b,terrace.elevationM,terrace.balustradeHeightM,materials.glass,materials.bronze)
  })
  return g
}
function garageRoof(roofMaterial: THREE.Material, stoneMaterial: THREE.Material) {
  const group=new THREE.Group()
  group.add(slabMesh(exteriorConcept.floors.garage.outlinePt,2.68,.18,roofMaterial))
  group.add(slabMesh(exteriorConcept.garageAppendix.outlinePt,2.68,.16,roofMaterial))
  group.add(slabMesh(exteriorConcept.floors.garage.outlinePt,-.24,.18,stoneMaterial))
  return group
}
function garageOutbuilding(palette: {stone:THREE.Material;roof:THREE.Material}) {
  const group=new THREE.Group(),outline=exteriorConcept.garageAppendix.outlinePt
  for(let i=0;i<outline.length;i++){
    const m=between(point3(outline[i]),point3(outline[(i+1)%outline.length]),.22,exteriorConcept.garageAppendix.heightM,palette.stone,0)
    if(m)group.add(m)
  }
  group.userData={source:'A-14 detached annex',roof:'conceptual'}
  return group
}
function garageShutter(mat: THREE.Material,frame: THREE.Material){
  // The wide southern opening on A-14 is clear in plan, but garage-door height is missing.
  const group=new THREE.Group()
  const a=point3([320*1190.52001953125/1448,643*841.9200439453125/1024])
  const b=point3([808*1190.52001953125/1448,643*841.9200439453125/1024])
  const door=between(a,b,.065,2.34,mat,0.12)
  if(door){ door.userData={garageShutter:'not-in-door-schedule',uncertain:true};group.add(door) }
  for(let i=0;i<9;i++){
    const y=.23+i*.24
    lineBeam(group,new THREE.Vector3(a.x,y,a.z-.045),new THREE.Vector3(b.x,y,b.z-.045),.012,frame)
  }
  return group
}

export function createExteriorConcept(opts:{
   floors:FloorId[]; roof:boolean; windows:boolean; terrace:boolean; garage:boolean; assembled:boolean
}) {
  const root=new THREE.Group()
  const palette={stone:mStone(),accent:mStoneAlt(),bronze:mBronze(),glass:mGlass(),roof:mRoof(),rooftop:mRooftop()}
  const individual=opts.floors.length===1
  for(const id of opts.floors){
    root.add(facadeRing(id,palette,individual,opts.windows))
    if(id==='garage')root.add(garageOutbuilding(palette))
  }
  if(opts.roof){
    if(opts.floors.includes('garage')) root.add(garageRoof(palette.roof,palette.stone))
    else if(opts.floors.includes('level-3') && opts.assembled){
      for(const roof of exteriorConcept.roof.gableWings)root.add(roofWing(roof,palette))
      if(opts.floors.length>1){
        for(const low of exteriorConcept.roof.lowRoofs){
          const cap=slabMesh(low.outlinePt,low.heightM,.14,palette.rooftop)
          cap.userData={lowRoof:low.id,notVerified:true};root.add(cap)
        }
      }
    }
  }
  if(opts.terrace && !opts.floors.includes('garage') && opts.floors.includes('level-2') && opts.assembled)
    root.add(terraceGroup(palette))
  if(opts.floors.includes('garage') && opts.garage)root.add(garageShutter(palette.roof,palette.bronze))
  root.userData={visualization:'owner-review-exterior-concept',approvedForConstruction:false,
    windowsCount:opts.windows?opts.floors.reduce((n,f)=>n+exteriorConcept.floors[f].windowsApproxCount,0):0}
  // No fake verified facade: windows stay part of facade geometry. 'windows' controls glazing layer (future).
  return root
}

export function createExteriorContext(): THREE.Group {
  const group=new THREE.Group()
  const grass=new THREE.MeshStandardMaterial({color:'#61776a',roughness:.98})
  const base=new THREE.Mesh(new THREE.PlaneGeometry(80,80),grass)
  base.rotation.x=-Math.PI/2;base.position.y=-.48;base.receiveShadow=true;group.add(base)
  // Context is deliberately sparse; actual Como terrain / roads / lake are unavailable.
  const shadowGrass=new THREE.MeshStandardMaterial({color:'#829786',roughness:1,side:THREE.DoubleSide})
  for(let i=0;i<6;i++){
    const x= i%2===0?-19:19
    const z=-13+i*5
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,1.6,7),new THREE.MeshStandardMaterial({color:'#574c40',roughness:1}))
    trunk.position.set(x,.35,z);group.add(trunk)
    const crown=new THREE.Mesh(new THREE.ConeGeometry(1.0,5.3,9),shadowGrass)
    crown.position.set(x,3.35,z);crown.castShadow=true;group.add(crown)
  }
  group.userData={vegetation:'demonstration-only-not-toposurvey'}
  return group
}
