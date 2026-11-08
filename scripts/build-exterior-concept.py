#!/usr/bin/env python3
"""Source-informed presentation envelope, registered to the A-04/05/06 frame.

Horizontal coordinates and window labels are read from the owner's PDF. Sills,
roof, terrain profile and exterior finishes remain explicitly presentation data.
The private PDF and original extracted 2D files are never modified/published.
Requires shapely==2.1.2. Run from any directory; output is deterministic.
"""
from pathlib import Path
import json, math
from shapely.geometry import Polygon, Point, box
from shapely.ops import triangulate, unary_union
from shapely.affinity import translate

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT/'src/data/spatial-model.json').read_text())
PPM = SOURCE['calibration']['pointsPerMeter']
# Confirmed repeated structural rectangles: A-15 -> A-04, A-17 -> A-06.
# This is page registration, not movement of any room relative to its own plan.
REG = {'level-1':[0,21.24], 'level-2':[0,0], 'level-3':[3.96,-6.96], 'garage':[0,0]}

# Outline in the common MEASUREMENT page frame. Straight wall coordinates taken
# from PDF filled-path boundaries; curved bay approximated by a smooth half ellipse.
def bay(x,y0,y1,rx):
    cy=(y0+y1)/2; ry=(y1-y0)/2
    return [[round(x-rx*math.sin(t),3),round(cy+ry*math.cos(t),3)]
            for t in [i*math.pi/24 for i in range(25)]]
COMMON = {
 'level-1':[[133.08,127.68],[551.88,127.68],[551.88,97.2],[930,97.2],
  [930,128.04],[1090.08,128.04],[1090.08,272.64],[1113.12,272.64],
  [1113.12,431.16],[1090.08,431.16],[1090.08,574.56],[914.04,574.56],
  [914.04,514.68],[762.72,514.68],[762.72,423.24],[460.44,423.24],
  [460.44,571.32],[133.8,571.32]] + bay(133.8,394.92,548.28,52.44) + [[133.08,394.92]],
 'level-2':[[134.16,128.76],[783.96,128.76],[783.96,196.2],[916.2,196.2],
  [916.2,128.76],[1089.12,128.76],[1089.12,272.64],[1112.16,272.64],
  [1112.16,428.88],[1089.12,428.88],[1089.12,574.56],[916.2,574.56],
  [916.2,513.6],[763.8,513.6],[763.8,420.72],[459.36,420.72],
  [459.36,570.24],[134.88,570.24]] + bay(134.88,395.64,547.68,53.28) + [[134.16,395.64]],
 'level-3':[[256.92,185.4],[750.24,185.4],[750.24,417.12],
  [520.08,417.12],[520.08,560.28],[256.92,560.28]],
 'garage':[[221.16,152.16],[591.12,152.16],[591.12,235.2],[699.72,235.2],
  [699.72,531.36],[148.8,531.36],[148.8,249.12],[221.16,249.12]],
}
BASE = {'level-1':0.,'level-2':2.93,'level-3':5.9,'garage':0.}
HEIGHT = {'level-1':2.65,'level-2':2.70,'level-3':2.30,'garage':2.65}

def local(fid,p): return [round(p[0]-REG[fid][0],3),round(p[1]-REG[fid][1],3)]
def ring(poly): return [[round(x,3),round(y,3)] for x,y in list(poly.exterior.coords)[:-1]]
def polygons(geom):
    if geom.is_empty: return []
    if geom.geom_type=='Polygon': return [geom]
    return [p for g in geom.geoms for p in polygons(g)]
def polydata(poly):
    return {'outer':ring(poly),'holes':[[[round(x,3),round(y,3)] for x,y in list(r.coords)[:-1]] for r in poly.interiors]}

# Centre, width, labelled opening height, display sill, provenance.
# Floor-height glazing is explicit, NEVER resized from a generic window preset.
WINDOWS = {
 'level-1':[
  (203.4,571.32,1.16,2.35,.04,'A-04 south: 1160 / Нок=2350'),
  (305.4,571.32,1.16,2.35,.04,'A-04 south: 1160 / Нок=2350'),
  (406.8,571.32,1.16,2.35,.04,'A-04 south: 1160 / Нок=2350'),
  *[(x,423.24,1.58,2.20,.04,'A-04 living front: 1580 / Нок=2200') for x in [490.2,569.4,651.6,733.0]],
  (762.72,465.6,1.4,2.2,.04,'A-04 living return: 1400 / Нок=2200'),
  (842.4,514.68,1.87,1.37,.72,'A-04 office: 1870 / Нок=1370'),
  (1002.0,574.56,.96,1.37,.72,'A-04 south service room: 960 / Нок=1370'),
  (1090.08,485.4,.76,2.0,.15,'A-04 east: 760 / Нок=2000'),
  (1113.12,367.8,1.36,1.20,.95,'A-04 east: 1360 / Нок=1200'),
  (1090.08,201.6,1.2,2.25,.05,'A-04 east: 1200 / Нок=2250'),
  (81.36,471.6,.87,1.537,.52,'A-04 curved bay: Нок=1537; width inferred'),
  (133.08,168.6,1.44,1.78,.6,'A-15 west opening / height inferred'),
  (133.08,290.4,1.37,1.78,.6,'A-15 west opening / height inferred'),
 ],
 'level-2':[
  (234.6,128.76,1.36,1.78,.62,'A-05 north: 1360 / Нок=1780'),
  (362.4,128.76,.97,1.78,.62,'A-05 north: 970 / Нок=1780'),
  (497.4,128.76,1.36,1.78,.62,'A-05 north: 1360 / Нок=1780'),
  (729.0,128.76,1.70,2.,.4,'A-05 north: 1700 / Нок=2000'),
  (783.96,171.,1.18,2.30,.05,'A-05 entrance return: 1180 / Нок=2300'),
  (853.2,196.2,2.626,2.35,.05,'A-05 stair landing: 2626 / Нок=2350'),
  *[(x,420.72,w,2.4,.04,'A-05 terrace glazing: Нок=2400') for x,w in [(492.6,1.5),(570.0,1.8),(651.6,1.8),(733.8,1.5)]],
  (134.16,317.4,1.36,1.78,.62,'A-05 west: 1360 / Нок=1780'),
  (841.8,513.6,1.87,1.65,.64,'A-05 dining return: 1870 / Нок=1650'),
  *[(x,570.24,1.4,1.78,.62,'A-05 south: 1400 / Нок=1780') for x in [204.,301.8,399.6]],
  *[(x,574.56,.97,1.65,.64,'A-05 dining south: 970 / Нок=1650') for x in [949.8,1002.6,1054.8]],
  (916.2,537.6,.96,1.65,.64,'A-05 dining west: 960 / Нок=1650'),
  (1089.12,468.6,1.15,2.36,.04,'A-05 dining east: 1150 / Нок=2360'),
  (1089.12,537.6,.96,1.65,.64,'A-05 dining east: 960 / Нок=1650'),
  (1002.6,128.76,.7,1.38,.92,'A-20 kitchen opening / height inferred'),
  (1050.,128.76,.7,1.38,.92,'A-20 kitchen opening / height inferred'),
  (1089.12,170.4,.85,1.65,.64,'A-20 kitchen east / height inferred'),
  (1089.12,221.4,.85,1.65,.64,'A-20 kitchen east / height inferred'),
  (1112.16,312.,.85,1.65,.64,'A-20 kitchen return / height inferred'),
  (1112.16,387.,.85,1.65,.64,'A-20 dining return / height inferred'),
 ],
 'level-3':[], # A-06 shows rooflights, not six invented vertical facade windows.
 'garage':[(221.16,196.,1.15,1.12,.95,'A-14 plan / height inferred'),
  (389.,152.16,1.25,1.12,.95,'A-14 plan / height inferred'),
  (523.,152.16,1.25,1.12,.95,'A-14 plan / height inferred')],
}

def distance_seg(p,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy),t

def data_floor(fid):
    outline=[local(fid,p) for p in COMMON[fid]]
    assert Polygon(outline).is_valid, fid
    segments=[{'id':f'{fid}-EX-{i:02d}','fromPt':a,'toPt':b,'lengthM':round(math.dist(a,b)/PPM,6),'windows':[],
               'earthContact':fid=='level-1' and max(a[1],b[1])+REG[fid][1]<=142.6}
              for i,(a,b) in enumerate(zip(outline,outline[1:]+outline[:1]))]
    entries=list(WINDOWS[fid])
    if fid=='level-2':
        # Three source-visible bay windows spanning adjacent smooth wall segments.
        for angle in [math.pi*.25,math.pi*.5,math.pi*.75]:
            entries.append((134.88-53.28*math.sin(angle),471.66+76.02*math.cos(angle),.87,1.78,.62,'A-05 curved bay: 870 / Нок=1780'))
    for i,(x,y,w,h,sill,label) in enumerate(entries):
        p=local(fid,[x,y]); (dist,ratio),index=min((distance_seg(p,s['fromPt'],s['toPt']),j) for j,s in enumerate(segments))
        assert dist/PPM < .35,(fid,p,dist)
        edge=segments[index]
        # Curved windows cross tiny planar tessellation edges: store as a projected
        # aperture interval over the whole bay arc, split into panels below.
        window={'id':f'{fid}-W-{i+1:02d}','at':round(ratio,6),'widthM':w,'sillM':sill,'heightM':h,
                'status':'source-dimensions-with-inferred-sill' if 'inferred' not in label else 'plan-position-with-inferred-elevation',
                'sourceLabel':label,'heightSource':'label' if 'Нок=' in label else 'inferred',
                'sillSource':'presentation-assumption','roomBinding':None}
        if edge['lengthM'] < w+.12:
            # Spread a curved bay aperture continuously by arc length, not one
            # minuscule window with an oversized frame on every sampled facet.
            bay_edges=[j for j,s in enumerate(segments) if 18<=j<42]
            total=sum(segments[j]['lengthM'] for j in bay_edges)
            centre=sum(segments[j]['lengthM'] for j in bay_edges if j<index)+ratio*edge['lengthM']
            cursor=0
            for j in bay_edges:
                target=segments[j]; length=target['lengthM']
                left=max(0,centre-w/2-cursor);right=min(length,centre+w/2-cursor)
                if right-left>.001:
                    target['windows'].append({**window,'id':window['id']+f'-{j}','at':(left+right)/2/length,'widthM':right-left,'curvedPanel':True})
                cursor+=length
        else:
            assert not edge['earthContact'], (fid,'opening in buried rear facade')
            edge['windows'].append(window)
    if fid=='garage':
        # True wall aperture; the former shutter was drawn over a solid wall.
        segments[4]['windows'].append({'id':'garage-entry','at':.5,'widthM':10.9,'sillM':.08,'heightM':2.34,
          'kind':'shutter','status':'plan-position-with-inferred-elevation','sourceLabel':'A-14 wide entry / height inferred',
          'heightSource':'inferred','sillSource':'presentation-assumption','roomBinding':None})
    for edge in segments:
        edge['windows'].sort(key=lambda w:w['at'])
        end=0
        for w in edge['windows']:
            left=w['at']*edge['lengthM']-w['widthM']/2;right=left+w['widthM']
            assert left>=-1e-4 and right<=edge['lengthM']+1e-4,(fid,edge['id'],w['id'])
            assert left>=end-1e-4,(fid,'overlapping apertures',edge['id'])
            assert w['sillM']+w['heightM']<HEIGHT[fid]
            end=right
    return {'sourceSheet':SOURCE['floors'][fid]['sourceSheet'],'sourceViewport':SOURCE['floors'][fid]['sourceViewport'],
     'status':'source-informed-provisional-exterior-silhouette','registrationOffsetPt':REG[fid],
     'baseM':BASE[fid],'displayWallHeightM':HEIGHT[fid],'outlinePt':outline,'facadeSegments':segments,
     'planAreaM2':round(Polygon(outline).area/PPM**2,2),'windowsApproxCount':len(entries),
     'openingPanelCount':sum(len(s['windows']) for s in segments)}

floors={fid:data_floor(fid) for fid in COMMON}
upper=Polygon(COMMON['level-2']); attic=Polygon(COMMON['level-3'])
terrace=box(459.36,420.72,763.8,513.6)
for fid,footprint in [('level-2',unary_union([Polygon(COMMON['level-1']),upper,terrace])),('level-3',unary_union([upper,attic]))]:
    f=floors[fid]; dx,dz=REG[fid]
    f['floorPlatePt']=[polydata(translate(p,xoff=-dx,yoff=-dz)) for p in polygons(footprint)]
    f['slabBaseM']=2.65 if fid=='level-2' else 5.63
    f['slabThicknessM']=.28 if fid=='level-2' else .27
# Full closed coverage: roof = upper-floor footprint minus attic, not three ad-hoc patches.
low_roofs=[{'id':f'flat-{i}','polygonPt':polydata(p),'heightM':5.901} for i,p in enumerate(polygons(upper.difference(attic)))]

# Construct a continuous L-shaped hipped roof from the upper envelope of two
# intersecting hip volumes. Clip occluded faces analytically, removing duplicate
# roofs, floating gable triangles, and overlapping coplanar surfaces.
def hip_rect(rect,rise):
    x0,z0,x1,z1=rect;mid=(z0+z1)/2; inset=(z1-z0)/2
    if x1-x0 < z1-z0:
        # Swap X/Z for the perpendicular wing.
        return [([(z,x) for x,z in pts],(b,a,c)) for pts,(a,b,c) in hip_rect((z0,x0,z1,x1),rise)]
    slope=rise/inset
    return [([(x0,z0),(x1,z0),(x1-inset,mid),(x0+inset,mid)],(0,slope,8.2-slope*z0)),
     ([(x0,z1),(x0+inset,mid),(x1-inset,mid),(x1,z1)],(0,-slope,8.2+slope*z1)),
     ([(x0,z0),(x0+inset,mid),(x0,z1)],(slope,0,8.2-slope*x0)),
     ([(x1,z0),(x1,z1),(x1-inset,mid)],(-slope,0,8.2+slope*x1))]

raw_faces=hip_rect((247.46,175.94,759.70,426.58),1.48)+hip_rect((247.46,175.94,529.54,569.74),1.48)
# Clip a polygon by a linear height difference > 0, for the hiding half-plane.
def above_clip(poly,coeff):
    a,b,c=coeff; pts=list(poly.exterior.coords)[:-1]; out=[]
    for p,q in zip(pts,pts[1:]+pts[:1]):
        vp=a*p[0]+b*p[1]+c;vq=a*q[0]+b*q[1]+c
        if vp>1e-9: out.append(p)
        if (vp>1e-9)!=(vq>1e-9):
            t=vp/(vp-vq); out.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    return Polygon(out) if len(out)>2 else Polygon()
roof_faces=[]
for i,(coords,plane) in enumerate(raw_faces):
    face=Polygon(coords)
    for j,(other,op) in enumerate(raw_faces):
        if i//4==j//4:continue
        occluder=above_clip(Polygon(other),tuple(op[k]-plane[k] for k in range(3)))
        face=face.difference(occluder)
    for poly in polygons(face):
        if poly.area<.001:continue
        roof_faces.append({'id':f'hip-{i}-{len(roof_faces)}','outlinePt':ring(poly),'plane':list(plane)})
roof_footprint=unary_union([Polygon(p['outlinePt']) for p in roof_faces])

def roof_y(p):
    values=[a*p[0]+b*p[1]+c for coords,(a,b,c) in raw_faces if Polygon(coords).buffer(.001).covers(Point(p))]
    return max(values) if values else 8.2

# Display hillside, qualitative owner clarification; not topographical survey.
# High rear plateau ends at the second-floor threshold, falls toward the front.
def grade(p):
    t=max(0.,min(1.,(p[1]-142.6)/(423.24-142.6)))
    return 2.90-3.12*(t*t*(3-2*t))
site=box(-220,-340,1420,990)
house=Polygon(COMMON['level-1'])
# Generate outside-only triangulation. Shared height function ensures continuity.
terrain_triangles=[]
for x in range(-220,1420,82):
 for y in range(-340,990,70):
    cell=box(x,y,min(x+82,1420),min(y+70,990)).difference(house)
    for p in polygons(cell):
     for tri in triangulate(p):
      if not p.covers(tri):continue
      terrain_triangles.append([[round(u,3),round(grade((u,v)),4),round(v,3)] for u,v in list(tri.exterior.coords)[:3]])
# Flat front walk on the lower garden level, clipped from the footprint.
paving=house.buffer(68,join_style=2).difference(house).intersection(box(-220,423.24,1420,990))
D={
 'schema':'villa-como-exterior-concept/2','sourceDocument':'MÈTRE Villa Como, 94-page PDF',
 'sourceSheets':['A-04','A-05','A-06','A-14','A-15','A-16','A-17','A-20'],
 'geometryMeaning':'Source-informed presentation, window label dimensions plus inferred sills; roof/site/finishes remain provisional',
 'isApprovedArchitecturalModel':False,'originPt':{'xPt':600,'yPt':350},'pointsPerMeter':PPM,
 'registration':{'targetFrame':'A-04/A-05/A-06 measurement plans','offsetsPt':REG,
   'checks':[{'from':'A-15','to':'A-04','translationPt':[0,21.24],'anchors':'south structural wall 537.00 -> 558.24; north wall 106.44 -> 127.68'},
             {'from':'A-17','to':'A-06','translationPt':[3.96,-6.96],'anchors':'west wall 252.96 -> 256.92; north wall 192.36 -> 185.40'}]},
 'missingSources':['roof plan','exterior elevations','building sections','site/master plan','verified sill elevations','garage geospatial relation'],
 'floors':floors,
 'roof':{'status':'conceptual-massing-only-not-source-verified','style':'continuous-intersecting-hip-roof',
   'faces':roof_faces,'boundaryPt':ring(roof_footprint),'eaveM':8.2,'lowRoofs':low_roofs,
   'skylights':[{'id':f'rooflight-{i+1}','centrePt':[x,z],'widthM':w,'heightM':h,'sourceSheet':'A-06','status':'plan-symbol-source-roof-pitch-inferred'}
      for i,(x,z,w,h) in enumerate([(307.2,362.4,.90,1.25),(431.4,223.2,.70,.90),(643.2,223.2,.70,.90),(647.4,326.4,.70,.90)])]},
 'terrace':{'sourceSheet':'A-20','roomNumber':13,'scheduleAreaM2':22.51,'status':'source-informed-display-outline',
   'polygonPt':[[459.36,420.72],[763.8,420.72],[763.8,513.6],[459.36,513.6]],
   'elevationM':2.93,'balustradeHeightM':1.04,'confirmedPosition':False},
 'garageAppendix':{'outlinePt':[[753.1,387.2],[915.9,390.6],[913.4,519.6],[756.4,512.1]],'heightM':2.65},
 'garagePlacement':{'mode':'isolated-only','rotationToHouseDegrees':90,'xyMeters':None,'onSitePositionApproved':False},
 'site':{'status':'owner-confirmed-slope-with-inferred-profile','rearGradeM':2.90,'frontGradeM':-.22,
   'rearContactMaxYPt':142.6,'buriedFloor':'level-1','rearFacadeHasOpenings':False,
   'trianglesPtM':terrain_triangles,'boundaryPt':ring(site),'pavingPt':[polydata(p) for p in polygons(paving)],
   'notSurveyed':True,'ownerClarification':'rear ground reaches level 2; level 1 rear facade is blind and embedded in hillside'},
 'stages':{'current':'3.6 exterior correction','remaining':[{'id':4,'name':'Interiors and materials'},{'id':5,'name':'Lighting and smart-home scenarios'}]},
}
OUT=ROOT/'src/data/exterior-concept.json'
OUT.write_text(json.dumps(D,ensure_ascii=False,indent=2)+'\n')
print('Generated registered exterior /2:',len(roof_faces),'roof surfaces,',len(terrain_triangles),'terrain triangles')
for fid,f in floors.items():print(fid,f['windowsApproxCount'],'window positions,',f['openingPanelCount'],'panels')
