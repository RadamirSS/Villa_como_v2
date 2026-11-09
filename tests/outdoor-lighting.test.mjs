import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
const b=await build({stdin:{contents:`export * from './src/domain/outdoorLighting';export * from './src/components/SiteLandscape'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false})
const m=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))
test('yard defaults migrate old saves and preserve explicit off, never claim source circuits',()=>{
 assert.equal(m.restoredCourtyard(null),true);assert.equal(m.restoredCourtyard({version:1,state:{}}),true)
 assert.equal(m.restoredCourtyard({version:1,courtyard:false}),false)
 assert.equal(m.restoredCourtyard({version:1,courtyard:true}),true)
 assert.equal(m.restoredCourtyard({version:1,courtyard:'false'}),true)
 assert.equal(m.courtyardEvidence,'demo-not-in-source-project')
 assert.equal(m.courtyardForScenario('away'),false)
 for(const id of ['arrival','evening','dinner','night-route'])assert.equal(m.courtyardForScenario(id),true)
})
test('yard power overrides dusk and night without rebuilding any geometry',()=>{
 const root=m.createSiteLandscape(),pools=[],lamps=[]
 root.traverse(o=>{if(o.isMesh&&o.material.name==='site-light-pool')pools.push(o);if(o.isMesh&&o.material.name==='site-warm-light')lamps.push(o)})
 const geometry=pools.map(o=>o.geometry)
 for(const time of ['day','dusk','night']){
  m.updateSiteTime(root,time,true);assert(pools.every(o=>o.visible));const colour=lamps[0].material.color.getHex()
  m.updateSiteTime(root,time,false);assert(pools.every(o=>!o.visible));assert.notEqual(lamps[0].material.color.getHex(),colour)
 }
 pools.forEach((o,i)=>assert.equal(o.geometry,geometry[i]))
})
