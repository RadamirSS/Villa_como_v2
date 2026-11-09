import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dir = new URL('../src/data/', import.meta.url)
const source = JSON.parse(readFileSync(new URL('spatial-model.json', dir),'utf8'))
const exterior = JSON.parse(readFileSync(new URL('exterior-concept.json', dir),'utf8'))
const ids = ['garage','level-1','level-2','level-3']
const expectedSources = { garage:'A-14','level-1':'A-15','level-2':'A-16','level-3':'A-17' }
const requiredMissing=['roof plan','exterior elevations','building sections','site/master plan']
assert.equal(exterior.schema,'villa-como-exterior-concept/2')
assert.equal(exterior.isApprovedArchitecturalModel,false)
assert.equal(exterior.pointsPerMeter,source.calibration.pointsPerMeter)
assert(requiredMissing.every(s=>exterior.missingSources.includes(s)))
assert.deepEqual(Object.keys(exterior.floors).sort(),ids.sort())
assert.equal(exterior.roof.status,'conceptual-massing-only-not-source-verified')
assert.deepEqual(exterior.garagePlacement?.xyMeters,[24.5,10.2])
assert.equal(exterior.garagePlacement?.onSitePositionApproved,false)
for(const id of ids){
  const f=exterior.floors[id]
  assert.equal(f.sourceSheet,expectedSources[id])
  assert(f.status.startsWith('source-informed-provisional'))
  assert.equal(f.outlinePt.length,f.facadeSegments.length)
  assert(f.facadeSegments.length >= 6)
  const sourcePts=source.floors[id].wallPolygonsPt.flatMap(poly=>poly.outer)
  const xs=sourcePts.map(p=>p[0]),ys=sourcePts.map(p=>p[1])
  const bound=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]
  const extXs=f.outlinePt.map(p=>p[0]),extYs=f.outlinePt.map(p=>p[1])
  const outer=[Math.min(...extXs),Math.min(...extYs),Math.max(...extXs),Math.max(...extYs)]
  assert(outer.every((n,i)=>Math.abs(n-bound[i]) < (id === 'garage' && i >= 2 ? 7 : 3)*exterior.pointsPerMeter), `${id}: concept boundary deviates excessively from source`)
  assert.equal(f.openingPanelCount,f.facadeSegments.reduce((sum,s)=>sum+s.windows.length,0))
  assert(f.windowsApproxCount >= 0)
  f.facadeSegments.forEach((edge,idx)=>{
    assert.equal(edge.id,`${id}-EX-${String(idx).padStart(2,'0')}`)
    assert.deepEqual(edge.fromPt,f.outlinePt[idx])
    assert.deepEqual(edge.toPt,f.outlinePt[(idx+1)%f.outlinePt.length])
    assert(edge.lengthM > 0)
    edge.windows.forEach(w=>{
      assert(w.widthM > 0 && w.widthM < (w.kind === 'shutter' ? 12 : 3))
      assert(w.at >= 0 && w.at <= 1)
      assert(w.sillM + w.heightM < f.displayWallHeightM)
      assert(['source-dimensions-with-inferred-sill','plan-position-with-inferred-elevation'].includes(w.status))
      assert.equal(w.sillSource,'presentation-assumption')
      assert(w.sourceLabel.length > 10)
    })
  })
}
assert.equal(exterior.terrace.sourceSheet,'A-20')
assert.equal(exterior.terrace.scheduleAreaM2,22.51)
assert.equal(exterior.terrace.confirmedPosition,false)
assert(exterior.roof.faces.length >= 6)
assert.equal(exterior.roof.skylights.length,4)
assert.equal(exterior.roof.lowRoofs.length,0)
assert.equal(exterior.roof.coverage,'entire-villa-including-unused-attic')
assert(exterior.roof.faces.every(f=>f.plane.length===3 && f.outlinePt.length>=3))
assert.equal(exterior.site.buriedFloor,'level-1')
assert.equal(exterior.site.rearFacadeHasOpenings,false)
assert.equal(exterior.site.notSurveyed,true)
assert(exterior.site.rearGradeM >= 2.85)
assert.equal(exterior.floors['level-3'].windowsApproxCount,0)
assert(exterior.floors['level-1'].facadeSegments.filter(s=>s.earthContact).every(s=>s.windows.length===0))
console.log('Stage 3.6: 4 PDF-registered conceptual facade outlines, conceptual glazing and gable roofs, terrace and isolated garage; no invented construction approval.')
