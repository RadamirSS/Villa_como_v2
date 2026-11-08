import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Raycaster, Vector3, Box3 } from 'three'
import { readFileSync } from 'node:fs'

const e = JSON.parse(readFileSync(new URL('../src/data/exterior-concept.json', import.meta.url)))
const output = await build({ entryPoints: [new URL('../src/components/ExteriorConcept.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false })
const { createExteriorConcept, createExteriorContext, createPlacedGarage, createUnusedAttic } = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'))
const options = { floors: ['level-1','level-2','level-3'], roof: true, windows: true, terrace: true, garage: false, assembled: true }
const sourcePoint = (x, z, y = 20) => new Vector3((x - 600) / 36.4, y, (z - 350) / 36.4)
const meshes = root => { const result = []; root.traverse(o => { if (o.isMesh) result.push(o) }); return result }

function contains(p, ring) {
 let inside = false
 for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
  if ((ring[i][1]>p[1]) !== (ring[j][1]>p[1]) && p[0] < (ring[j][0]-ring[i][0])*(p[1]-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0]) inside=!inside
 }
 return inside
}

test('registration compensates the actual page translations without editing original source coordinates', () => {
 assert.deepEqual(e.registration.offsetsPt['level-1'],[0,21.24])
 assert.deepEqual(e.registration.offsetsPt['level-3'],[3.96,-6.96])
 const f=e.floors['level-1']
 assert(Math.abs(f.outlinePt[0][1]+f.registrationOffsetPt[1]-127.68)<1e-8)
})

test('the buried rear facade has no apertures; source-height full glazing replaces the generic preset', () => {
 const rear=e.floors['level-1'].facadeSegments.filter(s=>s.earthContact)
 assert(rear.length>=5); assert(rear.every(s=>s.windows.length===0))
 for (const [id,h,count] of [['level-1',2.35,3],['level-2',2.4,4]]) {
  const w=e.floors[id].facadeSegments.flatMap(s=>s.windows).filter(w=>w.heightM===h && w.sillM<=.05)
  assert.equal(w.length,count)
 }
 assert.equal(e.floors['level-3'].windowsApproxCount,0)
 assert.equal(e.roof.skylights.length,4)
})

test('apertures fit their wall segment without overlap, including the continuous curved bay', () => {
 for (const f of Object.values(e.floors)) for (const s of f.facadeSegments) {
  let cursor=0
  for(const w of s.windows) {
   const left=w.at*s.lengthM-w.widthM/2,right=left+w.widthM
   assert(left>=cursor-1e-4,`${w.id} overlaps a previous window`)
   assert(right<=s.lengthM+1e-4,`${w.id} exceeds facade segment`)
   assert(w.sillM+w.heightM<f.displayWallHeightM)
   cursor=right
  }
 }
})

test('roof surfaces face upwards and cover the entire attic without overlapping layers or holes', () => {
 const root=createExteriorConcept({...options,batch:false}); root.updateMatrixWorld(true)
 const roof=meshes(root).filter(m=>m.userData.roofFace)
 assert(roof.length>=6)
 for (const mesh of roof) {
  const normal=mesh.geometry.getAttribute('normal')
  for(let i=0;i<normal.count;i++) assert(normal.getY(i)>.1,'inverted or vertical roof face')
 }
 const ring=e.floors['level-3'].outlinePt.map(([x,z])=>[x+3.96,z-6.96])
 let checks=0
 for(let x=265;x<745;x+=31) for(let z=195;z<554;z+=29) {
  if(!contains([x,z],ring))continue
  const ray=new Raycaster(sourcePoint(x,z),new Vector3(0,-1,0))
  const hits=ray.intersectObjects(roof,false)
  const heights=new Set(hits.map(hit=>Math.round(hit.point.y*1000)))
  assert.equal(heights.size,1,`roof missing or overlapping at ${x},${z}`)
  checks++
 }
 assert(checks>100)
})

test('solid inter-storey bands close the former horizontal holes', () => {
 const root=createExteriorConcept({...options,batch:false}); root.updateMatrixWorld(true)
 const masonry=meshes(root).filter(m=>!m.material.transparent)
 for(const [y,z] of [[2.80,580],[5.77,580]]) {
  const ray=new Raycaster(sourcePoint(380,z,y),new Vector3(0,0,-1))
  assert(ray.intersectObjects(masonry,false).length>0,`open band at height ${y}`)
 }
})

test('hillside is high behind the house and contains no earth surface inside rooms', () => {
 assert.equal(e.site.rearGradeM,2.90)
 assert.equal(e.site.frontGradeM,-.22)
 const root=createExteriorContext(); root.updateMatrixWorld(true)
 // The rear corridor is inside the lower-floor outline; the terrain is cut out.
 const ray=new Raycaster(sourcePoint(600,135),new Vector3(0,-1,0))
 assert.equal(ray.intersectObjects(meshes(root),false).length,0)
})

test('all scene vertices are finite and static batching keeps the phone draw-call budget small', () => {
 const root=createExteriorConcept(options); root.updateMatrixWorld(true)
 const list=meshes(root)
 assert(list.length<95,`${list.length} mesh draw calls`)
 let transparent=0
 for(const mesh of list) {
  const p=mesh.geometry.getAttribute('position')
  for(let i=0;i<p.array.length;i++)assert(Number.isFinite(p.array[i]))
  if(mesh.material.transparent)transparent++
 }
 assert(transparent>=40,'glazing remains individually addressable for stage 5')
})

test('roof, glazing, terrace and isolated garage switches change the real geometry', () => {
 const full=createExteriorConcept({...options,batch:false})
 const empty=createExteriorConcept({...options,roof:false,windows:false,terrace:false,batch:false})
 assert(meshes(full).length>meshes(empty).length)
 assert(!meshes(empty).some(m=>m.userData.roofFace || m.userData.skylight || m.userData.smartHomeTarget))
 const garage=createExteriorConcept({...options,floors:['garage'],batch:false})
 assert(meshes(garage).some(m=>m.userData.facadeEdgeId?.startsWith('garage-')))
 assert(!meshes(garage).some(m=>m.userData.facadeEdgeId?.startsWith('level-')))
})


test('roof glazing stays planar instead of folding across a roof hip', () => {
 const root=createExteriorConcept({...options,batch:false})
 const skylights=meshes(root).filter(m=>m.userData.skylight)
 assert.equal(skylights.length,4)
 for(const m of skylights) {
  const p=m.geometry.getAttribute('position')
  const a=new Vector3().fromBufferAttribute(p,0),b=new Vector3().fromBufferAttribute(p,1),c=new Vector3().fromBufferAttribute(p,2)
  const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize()
  assert(normal.y>0)
  for(let i=0;i<p.count;i++)assert(Math.abs(new Vector3().fromBufferAttribute(p,i).sub(a).dot(normal))<1e-5)
 }
})


test('the common pitched roof covers the whole second floor including the unused right attic', () => {
 const root=createExteriorConcept({...options,batch:false});root.updateMatrixWorld(true)
 const roof=meshes(root).filter(m=>m.userData.roofFace)
 const outline=e.floors['level-2'].outlinePt
 let tested=0
 for(let x=145;x<1100;x+=47)for(let z=140;z<570;z+=39){
  if(!contains([x,z],outline))continue
  const hits=new Raycaster(sourcePoint(x,z),new Vector3(0,-1,0)).intersectObjects(roof,false)
  assert.equal(new Set(hits.map(h=>Math.round(h.point.y*1000))).size,1,`missing common roof at ${x},${z}`)
  tested++
 }
 assert(tested>100)
 assert.equal(e.roof.lowRoofs.length,0)
 assert(!meshes(root).some(m=>m.userData.floorId==='level-3'))
})

test('garage is on the right and the yard entrance faces the balcony side', () => {
 const g=createPlacedGarage();g.updateMatrixWorld(true)
 const bounds=new Box3().setFromObject(g)
 assert(bounds.min.x>14.2)
 assert.equal(g.rotation.y,-Math.PI/2)
 assert.equal(g.position.y,0)
 assert.equal(e.garagePlacement.gateFacing,'balcony-front-positive-z')
 const site=createExteriorContext()
 const parts=meshes(site).flatMap(m=>m.userData.parts??[m.userData])
 assert(parts.some(p=>p.siteObject==='courtyard-gate'&&p.facing==='balcony-front-positive-z'))
})

test('unused attic is a physical floor area and is not added to the room register', () => {
 const g=createUnusedAttic();assert.equal(g.userData.notHabitableRoom,true)
 assert(meshes(g).length>0)
 const box=new Box3().setFromObject(g);assert(box.max.x>13)
})

test('floor overview walls stay low while the source mode retains full heights', async () => {
 const out=await build({entryPoints:[new URL('../src/components/Villa3D.tsx',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false})
 const mod=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'))
 for(const id of ['level-1','level-2','level-3','garage']){
  const low=mod.wallAndSlabGroup(id,.55,true,true,true)
  const high=mod.wallAndSlabGroup(id,2.65,true,true,false)
  assert(new Box3().setFromObject(low).max.y<.56)
  assert(new Box3().setFromObject(high).max.y>2.6)
 }
})
