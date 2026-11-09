import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {Box3} from 'three'
const out=await build({stdin:{contents:`export * from './src/components/SiteLandscape';export {createPlacedGarage,createExteriorContext} from './src/components/ExteriorConcept'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false})
const m=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'))
test('entrance is to the right of garage facing its gates and driveway connects to apron',()=>{
 const garage=m.createPlacedGarage();garage.updateMatrixWorld(true)
 const bounds=new Box3().setFromObject(garage)
 assert(m.siteLayout.drive.minX>bounds.max.x)
 assert.equal(m.siteLayout.gate.centreX,34)
 assert.equal(m.siteLayout.drive.courtZ,23)
 const site=m.createSiteLandscape();const kinds=new Set();site.traverse(o=>kinds.add(o.userData.siteObject))
 for(const kind of ['garage-apron','entrance-drive','courtyard-gate','entrance-walk','permeable-parking','path-light','olive-canopy'])assert(kinds.has(kind),kind)
 assert(![...kinds].some(k=>/ramp|bridge|elevated/.test(k??'')))
})
test('landscape stays finite and batches to a practical draw-call budget',()=>{
 const root=m.createExteriorContext();let meshes=0
 root.traverse(o=>{if(!o.isMesh)return;meshes++;for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n))})
 assert(meshes<65,`site has ${meshes} meshes`)
 const bounds=new Box3().setFromObject(root);assert(bounds.max.x<=40.1);assert(bounds.max.z<=36.1)
})
test('outdoor light pools respond to time without rebuilding geometry',()=>{
 const root=m.createExteriorContext();const pools=[];root.traverse(o=>{if(o.isMesh&&o.material.name==='site-light-pool')pools.push(o)})
 assert(pools.length>=8);const geometries=pools.map(o=>o.geometry)
 m.updateSiteTime(root,'day');assert(pools.every(o=>!o.visible))
 m.updateSiteTime(root,'night');assert(pools.every(o=>o.visible&&o.material.opacity===.23))
 pools.forEach((o,i)=>assert.equal(o.geometry,geometries[i]))
})
