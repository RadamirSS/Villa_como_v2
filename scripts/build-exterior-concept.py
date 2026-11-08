#!/usr/bin/env python3
"""Generate a clearly provisional facade/roof concept attached to PDF plan coordinates.

The provided 94-page MÈTRE PDF contains floor plans but NOT a complete elevations,
sections, roof, or site package. All hand-extracted exterior traces are OPEN
interpretations of the specific A-14..A-17 graphic at uniform 1448px screenshot
width; *never* identify them as approved CAD boundaries. The output keeps the
four stage-3 floor frames unchanged and does not reassign garage to the site.
"""
from pathlib import Path
import json, math
from shapely.geometry import Polygon, Point

ROOT=Path(__file__).resolve().parents[1]
SOURCE=json.loads((ROOT/'src/data/spatial-model.json').read_text())
POINTS_PER_M=SOURCE['calibration']['pointsPerMeter']
# PNGs were exported in the same PDF page coordinates (image width 1448 px).
PAGE_TO_IMAGE=1190.52001953125/1448.0
PAGE_Y_TO_IMAGE=841.9200439453125/1024.0

def pix(x,y): return [round(x*PAGE_TO_IMAGE,3),round(y*PAGE_Y_TO_IMAGE,3)]

def xy(points): return [pix(x,y) for x,y in points]

# Explicit source-traced silhouette: conservative outline, not a cadastral roof shape.
# The concave 1/2-floor recess facing the middle terrace and curved bay are preserved.
# Each 2D vertex is recorded so an owner may replace it from future DWG/facades.
OUTLINES = {
 'level-1': [
  (161,129),(585,129),(585,145),(669,145),(669,92),(1131,92),
  (1131,129),(1156,129),(1156,145),(1326,145),(1326,280),
  (1351,280),(1351,669),(1131,669),(1131,582),(929,582),
  (929,480),(560,480),(560,669),(162,669),(162,641),
  (137,632),(113,610),(100,582),(99,533),(112,503),(137,476),
  (161,457)
 ],
 'level-2': [
  (162,157),(941,157),(941,239),(1114,239),(1114,156),
  (1326,156),(1326,328),(1352,328),(1352,524),(1324,524),
  (1324,699),(1113,699),(1113,607),(929,607),(929,491),
  (549,491),(549,693),(162,693),(162,672),(134,654),
  (111,624),(99,591),(99,540),(115,512),(162,489)
 ],
 'level-3':[
  (307,233),(907,233),(907,516),(626,516),(626,690),
  (307,690)
 ],
 'garage':[
  (269,185),(719,185),(719,286),(851,286),(851,646),
  (181,646),(181,303),(269,303)
 ],
}
# The detached garage-side technical node is present on A-14 but its connection
# geometry cannot be inferred as a roofed corridor. Render separately.
GARAGE_APPENDIX=[(916,471),(1114,475),(1111,632),(920,623)]

# Window locations are *illustrative concepts* selected by reading gaps/symbols
# in 1:50 floor drawings; sill and facade compositions are NOT specified by source.
# Model uses edge fractional positions to remain attached to traced outline.
# Auto-generated windows are NOT used; no hidden random guesses.
WINDOWS={
 'level-1':[
  # x,y = opening center in the original PNG plan, width in meters
  (467,129,1.7),(745,92,1.8),(1180,145,1.5),(1326,214,1.25),
  (1351,398,1.8),(1351,586,1.55),(1216,669,1.8),
  (1005,582,1.7),(720,480,1.75),(424,669,1.4),(320,669,1.6),
  (231,669,1.3),(100,559,.6),(119,493,.55),(164,268,1.4)
 ],
 'level-2':[
  (281,157,1.55),(457,157,1.4),(609,157,1.65),(876,157,1.55),
  (1187,156,1.65),(1352,427,1.35),(1324,615,1.1),
  (1210,699,1.65),(1020,607,1.3),(736,491,1.8),
  (457,693,1.8),(280,693,1.7),(99,568,.65),(163,405,1.2)
 ],
 'level-3':[
  (390,233,1.05),(655,233,1.2),(907,361,1.05),(626,597,1.05),
  (437,690,1.15),(307,385,1.0)
 ],
 'garage':[
  (269,240,1.15),(472,185,1.25),(635,185,1.25),(719,222,.85),
  (851,437,1.4),(181,418,.85)
 ]
}

FLOOR_BASES={'level-1':0.0,'level-2':2.93,'level-3':SOURCE['displayAssumptions']['level3BaseM'],'garage':0.0}
WALL_HEIGHTS={'level-1':2.65,'level-2':2.65,'level-3':2.30,'garage':2.65}

def distance_seg(pt,a,b):
    ax,ay=a; bx,by=b; px,py=pt
    dx,dy=bx-ax,by-ay
    q=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/max(dx*dx+dy*dy,1e-8)))
    return math.hypot(px-ax-q*dx,py-ay-q*dy),q

def data_floor(name):
    outline=xy(OUTLINES[name]); polygon=Polygon(outline)
    if not polygon.is_valid: raise ValueError((name,'self-intersecting exterior conceptual outline'))
    if not polygon.exterior.is_ccw:
        # Preserve trace starting vertex and intended indexing, but ensure normal direction in 3D separately.
        pass
    segments=[]
    for idx,(a,b) in enumerate(zip(outline,outline[1:]+outline[:1])):
        length=math.dist(a,b)/POINTS_PER_M
        segments.append({'id':f'{name}-EX-{idx:02d}','fromPt':a,'toPt':b,'lengthM':round(length,3),'windows':[]})
    for x,y,width in WINDOWS[name]:
        pt=pix(x,y)
        options=[(distance_seg(pt,s['fromPt'],s['toPt']),i) for i,s in enumerate(segments)]
        (dist,ratio),ix=min(options,key=lambda q:q[0][0])
        # Avoid nearly everything except a plausible source edge.
        if dist/POINTS_PER_M>.5:
            raise ValueError((name,'window not near exterior concept',pt,dist))
        width=min(width,max(.3,segments[ix]['lengthM']-.3))
        segments[ix]['windows'].append({'id':f'{name}-W-{x}-{y}', 'at':round(ratio,4),'widthM':width,'sillM':.66 if name!='garage' else .95,
            'heightM':1.43 if name!='garage' else 1.12,
            'status':'hypothetical-window-size-and-design','sourceHintPx':[x,y]})
    for s in segments:
        s['windows'].sort(key=lambda w:w['at'])
    return {
      'sourceSheet': SOURCE['floors'][name]['sourceSheet'],
      'sourceViewport':SOURCE['floors'][name]['sourceViewport'],
      'status':'source-informed-provisional-exterior-silhouette',
      'baseM':FLOOR_BASES[name], 'displayWallHeightM':WALL_HEIGHTS[name],
      'outlinePt':outline,'facadeSegments':segments,
      'planAreaM2':round(polygon.area/POINTS_PER_M**2,2),
      'windowsApproxCount':len(WINDOWS[name]),
    }

D={
 'schema':'villa-como-exterior-concept/1',
 'sourceDocument':'MÈTRE Villa Como, 94-page working PDF 09.02.2026',
 'sourceSheets':['A-14','A-15','A-16','A-17','A-20'],
 'geometryMeaning':'Architectural concept envelope reconstructed from PDF plan silhouettes, NOT surveyed facades, architectural elevations or exact roof geometry',
 'isApprovedArchitecturalModel':False,
 'originPt':{'xPt':600,'yPt':350},'pointsPerMeter':POINTS_PER_M,
 'missingSources':['roof plan','exterior elevations','building sections','site/master plan','verified windows and glazing schedules','garage geospatial relation'],
 'materialPalette':{'stone':'warm limestone (concept)','roof':'charcoal standing seam (concept)','glass':'cool neutral glass (concept)','frames':'bronze metal (concept)'},
 'floors':{name:data_floor(name) for name in OUTLINES},
 'roof':{
   'status':'conceptual-massing-only-not-source-verified',
   'style':'contemporary-gable-and-flat-roof-demonstration',
   'gableWings':[
    {'id':'attic-main','originSheet':'A-17','rectPt':xy([(305,231),(911,231),(911,519),(305,519)]),'eaveYMetres':8.15,'ridgeRiseM':1.55,'overhangM':.26,'ridgeDirection':'x'},
    {'id':'attic-south-wing','originSheet':'A-17','rectPt':xy([(307,514),(629,514),(629,692),(307,692)]),'eaveYMetres':8.15,'ridgeRiseM':.88,'overhangM':.24,'ridgeDirection':'x'}
   ],
   # Representative low roofs only over parts of level-2 not occupied by attic.
   'lowRoofs':[
    {'id':'west-north','outlinePt':xy([(161,154),(306,154),(306,234),(680,234),(680,326),(420,326),(420,490),(161,490)]),'heightM':5.7},
    {'id':'east-upper','outlinePt':xy([(912,150),(941,150),(941,241),(1111,241),(1111,152),(1329,152),(1329,328),(1112,328),(1112,287),(911,287)]),'heightM':5.7},
    {'id':'east-lower','outlinePt':xy([(1111,524),(1325,524),(1325,701),(1111,701)]),'heightM':5.7},
   ],
 },
 'terrace':{'sourceSheet':'A-20','roomNumber':13,'scheduleAreaM2':22.51,
    'status':'inferred-plan-outline-not-surveyed-edge','polygonPt':xy([(558,494),(925,494),(925,602),(558,602)]),
    'elevationM':2.93,'balustradeHeightM':1.06,'confirmedPosition':False},
 'garageAppendix':{'sourceSheet':'A-14','status':'outline-present-but-conceptual-roof','outlinePt':xy(GARAGE_APPENDIX),'heightM':2.65},
 'garagePlacement':{'mode':'isolated-only','rotationToHouseDegrees':90,
    'relationToHouse':'owner-reported-right-side-at-level-1','xyMeters':None,'source':'owner clarification, no master plan',
    'onSitePositionApproved':False},
 'context':{'vegetation':'illustrative-only','ground':'illustrative-only','water':'not shown, no verified lake view in source'},
}
OUT=ROOT/'src/data/exterior-concept.json'
OUT.write_text(json.dumps(D,ensure_ascii=False,indent=2)+'\n')
print('Wrote',OUT)
for key,v in D['floors'].items():
    print(key,'outline points',len(v['outlinePt']),'windows',v['windowsApproxCount'],'area concept',v['planAreaM2'])
