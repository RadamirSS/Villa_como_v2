#!/usr/bin/env python3
"""Extract verifiable architectural geometry from the owner's MÈTRE PDF.

Strict provenance:
- dimension-chain segments must exist as actual lines on source sheets;
- door leaf symbols are matched to printed callouts and source schedule;
- an inferred lintel is never placed without a source-visible empty wall opening;
- unsupported slab, stair and roof geometry remain explicitly unverified.

Usage: python scripts/build-architectural-geometry.py /path/to/94-page-source.pdf
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

import cv2
import fitz
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PLANS = json.loads((ROOT / 'src/data/architectural-plans.json').read_text())['floors']
SPATIAL = json.loads((ROOT / 'src/data/spatial-model.json').read_text())
POINTS_PER_METER = SPATIAL['calibration']['pointsPerMeter']

# The measured dimensions and the source endpoints below were independently
# checked on the measurement lines in the supplied PDF; coordinates in PDF pt.
# This is NOT a complete closed dimension network.
ANCHORS = {
 'garage': [
  ('A-03', 3, 12690, (231.20, 480.72), (689.40, 480.72), 'Измеренная фасадная размерная линия'),
  ('A-03', 3, 9650, (231.20, 193.99), (581.60, 193.99), 'Ширина основного участка'),
 ],
 'level-1': [
  ('A-15', 15, 8465, (142.68, 572.76), (451.08, 572.76), 'Чистовой размер левого крыла'),
  ('A-15', 15, 5790, (556.44, 158.64), (766.00, 158.64), 'Чистовая горизонтальная цепочка холла'),
 ],
 'level-2': [
  ('A-05', 5, 10080, (556.44, 284.28), (922.20, 284.28), 'Обмерный горизонтальный размер гостиной'),
  ('A-16', 16, 10040, (561.48, 316.80), (921.48, 316.80), 'Чистовой горизонтальный размер гостиной'),
 ],
 'level-3': [
  ('A-06', 6, 13020, (274.00, 153.84), (743.80, 153.84), 'Горизонтальный общий размер мансарды'),
  ('A-06', 6, 6700, (497.88, 173.64), (743.80, 173.64), 'Размер правой части мансарды'),
 ],
}


def close_line(page, p1, p2, tolerance=0.18):
    for shape in page.get_drawings():
        for item in shape['items']:
            if item[0] != 'l':
                continue
            a,b=item[1:]
            if (math.dist((a.x,a.y),p1)<tolerance and math.dist((b.x,b.y),p2)<tolerance) or (math.dist((b.x,b.y),p1)<tolerance and math.dist((a.x,a.y),p2)<tolerance):
                return True
    return False


def dimension_anchors(doc, fid):
    checks=[]
    for sheet,index,mm,a,b,why in ANCHORS[fid]:
        if not close_line(doc[index-1],a,b,0.25):
            # PDF vectors may encode dimensions as slightly shifted pairs;
            # leave fail closed rather than manufacture a reference dimension.
            raise RuntimeError(f'No vector dimension line at {sheet}: {mm} mm, {a}-{b}')
        measured=math.dist(a,b)
        expected=mm / 1000 * POINTS_PER_METER
        delta_pct=round((measured-expected)/expected*100,3)
        checks.append({'sheet':sheet,'page':index,'label':why,'dimensionMm':mm,
                       'sourceStartPt':[round(v,2) for v in a],
                       'sourceEndPt':[round(v,2) for v in b],
                       'observedLengthPt':round(measured,2),'scalePointsPerM':round(measured/(mm/1000),3),
                       'residualAtDisplayScalePct':delta_pct,
                       'confidence':'source-line-and-dimension-label-observed',
                       'validation':'dimension-anchor-only-not-closed-chain'})
    return checks


def gray_mask(doc, info):
    p=doc[info['finalPage']-1]
    ox,oy=info['cropOriginPts']; v=info['viewport']
    clip=fitz.Rect(ox,oy,ox+v['width'],oy+v['height']) & p.rect
    pix=p.get_pixmap(matrix=fitz.Matrix(3,3),clip=clip,alpha=False)
    image=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,3)
    dark=((np.abs(image[:,:,0].astype('int16')-100)<=5)&
          (np.abs(image[:,:,1].astype('int16')-100)<=5)&
          (np.abs(image[:,:,2].astype('int16')-100)<=5)).astype('uint8')*255
    dist=cv2.distanceTransform(255-dark,cv2.DIST_L2,5)
    def sample(pt):
        col=int(round((pt[0]-clip.x0)*3)); row=int(round((pt[1]-clip.y0)*3))
        if not (0<=row<dist.shape[0] and 0<=col<dist.shape[1]):
            return 999.0,False
        return float(dist[row,col])/3,bool(dark[row,col])
    return sample


def labels_and_diagonals(page, info):
    words=page.get_text('words')
    spec={o['mark']:o for o in info['doorSpecification']}
    labels=[]
    ox,oy=info['cropOriginPts'];v=info['viewport']
    for w in words:
        if w[4]!='Д' or w[0]>ox+v['width'] or w[1]>min(500,oy+v['height']) or w[0]<ox or w[1]<oy:
            continue
        matches=[u for u in words if 0<u[0]-w[0]<42 and abs(u[1]-w[1])<4 and re.fullmatch(r'\d+(?:\.\d+)?',u[4])]
        if not matches: continue
        mark='Д'+min(matches,key=lambda u:u[0])[4]
        if mark not in spec:continue
        # The garage sheet contains one extra D01 in the specification/notes.
        if info['finalSheet']=='A-14' and w[0]>800:continue
        labels.append({'mark':mark,'center':[(w[0]+w[2])/2,(w[1]+w[3])/2]})
    lines=[]
    for obj in page.get_drawings():
        color=obj['color']
        if color is None or max(color)>.25:continue
        for item in obj['items']:
            if item[0]!='l':continue
            a,b=item[1:];dx=b.x-a.x;dy=b.y-a.y
            length=math.hypot(dx,dy)
            if not (12<length<75 and abs(abs(dx)-abs(dy))<4):continue
            p0=(a.x,a.y);p1=(b.x,b.y)
            center=((a.x+b.x)/2,(a.y+b.y)/2)
            if not (ox<center[0]<ox+v['width'] and oy<center[1]<oy+v['height']):continue
            if any(math.dist(center,other['center'])<1.75 and abs(length-other['length'])<2 for other in lines):continue
            lines.append({'a':p0,'b':p1,'center':center,'length':length})
    return labels,lines


def infer_portal(leaf, sample, opening_width_mm):
    ends=[leaf['a'],leaf['b']]
    hinge=min(ends,key=lambda point:sample(point)[0])
    free=ends[1] if hinge==ends[0] else ends[0]
    near=sample(hinge)[0]
    if near>2.5:return {'status':'unresolved','reason':'symbol hinge does not touch source wall'}
    span=opening_width_mm/1000*POINTS_PER_METER
    axes=[]
    for axis in ('x','y'):
        sg=math.copysign(1,(free[0]-hinge[0]) if axis=='x' else (free[1]-hinge[1]))
        vx,vy=(sg,0) if axis=='x' else (0,sg)
        occupied=0;count=0
        for n in range(12,94,5):
            t=n/100
            for offset in (-1.2,0,1.2):
                q=(hinge[0]+vx*span*t-vy*offset,hinge[1]+vy*span*t+vx*offset)
                occupied+=int(sample(q)[1]);count+=1
        end=(hinge[0]+vx*span,hinge[1]+vy*span)
        distance=sample(end)[0]
        axes.append({'axis':axis,'from':hinge,'to':end,'wallAtEndDistancePt':round(distance,2),
                     'sourceGapOccupancy':round(occupied/count,3)})
    admissible=[x for x in axes if x['wallAtEndDistancePt']<=3.2 and x['sourceGapOccupancy']<.13]
    if len(admissible)!=1:
        return {'status':'unresolved','reason':'cannot uniquely establish wall aperture from original ink',
                'candidates':axes}
    winner=admissible[0]
    return {'status':'source-gap-correlated-not-construction-approved','axis':winner['axis'],
            'startPt':[round(v,2) for v in winner['from']],
            'endPt':[round(v,2) for v in winner['to']],
            'wallAtEndDistancePt':winner['wallAtEndDistancePt'],
            'sourceGapOccupancy':winner['sourceGapOccupancy'],
            'heightMmFromDoorSchedule':True}


def doors(doc,fid,info):
    page=doc[info['finalPage']-1]
    labels,diags=labels_and_diagonals(page,info)
    wanted=sum(x['count'] for x in info['doorSpecification'])
    if len(labels)!=wanted:
        raise RuntimeError(f'{fid} expected {wanted} door labels, detected {len(labels)}')
    # Greedy global assignment: each printed label must match one unique 45deg door-leaf ink.
    pairs=sorted((math.dist(m['center'],d['center']),i,j) for i,m in enumerate(labels) for j,d in enumerate(diags))
    assigned={};used=set()
    for distance,i,j in pairs:
        if i not in assigned and j not in used and distance<40:
            assigned[i]=(j,distance);used.add(j)
    if len(assigned)!=wanted:
        raise RuntimeError(f'{fid} only {len(assigned)}/{wanted} labels resolved to source door graphics')
    sample=gray_mask(doc,info)
    specs={x['mark']:x for x in info['doorSpecification']}
    result=[]
    occurrence={}
    for i,m in enumerate(labels):
        leaf=diags[assigned[i][0]];spec=specs[m['mark']]
        a,b=leaf['a'],leaf['b']
        hinge=min([a,b],key=lambda point:sample(point)[0])
        occurrence[m['mark']]=occurrence.get(m['mark'],0)+1
        rec={'id':fid+'/'+m['mark']+'/'+str(occurrence[m['mark']]),'mark':m['mark'],
             'sourceSheet':info['finalSheet'],'sourcePage':info['finalPage'],
             'sourceLabelPt':[round(v,2) for v in m['center']],
             'sourceLeafSegmentPt':[[round(v,2) for v in a],[round(v,2) for v in b]],
             'hingeCandidatePt':[round(v,2) for v in hinge],
             'symbolMatchDistancePt':round(assigned[i][1],2),
             'openingWidthMm':spec['openingWidthMm'],'openingHeightMm':spec['openingHeightMm'],
             'leafWidthMm':spec['leafWidthMm'],'leafHeightMm':spec['leafHeightMm'],
             'swing':spec['swing'], 'sourceConfidence':'source-vector-symbol-and-door-schedule',
             'aperture':infer_portal(leaf,sample,spec['openingWidthMm'])}
        result.append(rec)
    return sorted(result,key=lambda x:(float(x['mark'][1:]) if x['mark'][1:].replace('.','',1).isdigit() else 999))


def stable_walls(fid):
    out=[]
    for i,p in enumerate(SPATIAL['floors'][fid]['wallPolygonsPt']):
        digest=hashlib.sha256(json.dumps(p,sort_keys=True,separators=(',',':')).encode()).hexdigest()[:11]
        coords=p['outer'];xs=[q[0] for q in coords];ys=[q[1] for q in coords]
        out.append({'id':f'wall-{fid}-{digest}','sourcePolygonIndex':i,
                    'bboxPt':[round(min(xs),2),round(min(ys),2),round(max(xs),2),round(max(ys),2)],
                    'classification':'source-wall-fill-footprint',
                    'verticalGeometryVerified':False})
    return out


def main():
    a=argparse.ArgumentParser();a.add_argument('pdf');a.add_argument('--output',default='src/data/architectural-geometry.json');args=a.parse_args()
    with fitz.open(args.pdf) as doc:
        if len(doc)!=94:raise ValueError('Expected 94-page MÈTRE source PDF')
        records={}
        for fid,info in PLANS.items():
            door_items=doors(doc,fid,info)
            records[fid]={'sourceSheet':info['finalSheet'],
              'calibrationChecks':dimension_anchors(doc,fid),
              'sourceWalls':stable_walls(fid),
              'doors':door_items,
              'openingCountResolved':sum(d['aperture']['status'].startswith('source-gap-') for d in door_items),
              'openingCountUnresolved':sum(d['aperture']['status']=='unresolved' for d in door_items),
              'stairGeometry':{'status':'not-verified','reason':'source sheets lack complete supported rise/run, exact stairwell boundary and slab opening'},
              'slabGeometry':{'status':'provisional-envelope','reason':'stage 3 morphological floor surface is not a structural slab plan'}}
    output={'schema':'villa-como-v2/architectural-geometry/1',
        'source':'MÈTRE working project PDF, 94 pages; derived source geometry',
        'sourcePdfSha256':hashlib.sha256(Path(args.pdf).read_bytes()).hexdigest(),
        'coordinateSpace':'common source PDF points, floor projection retains stage-3 global registration',
        'displayPointsPerMeter':POINTS_PER_METER,
        'status':'source-dimension-and-door-ink-registered; not certified metric BIM',
        'levelElevationsMm':{'garage':{'value':0,'confidence':'owner-level-only-no-site-transform'},
          'level-1':{'value':0,'confidence':'A-04-confirmed'},
          'level-2':{'value':2930,'confidence':'A-05-confirmed'},
          'level-3':{'value':5900,'confidence':'display-assumption-not-approved'}},
        'unresolvedConstraints':['whole-building closure of dimension chains','site/facades/roof sections',
          'all windows: mounting elevations and complete source schedules','verified stair treads and rise/run',
          'actual structural slabs and stairwell voids','all door portal axes and heights relative to true wall tops'],
        'floors':records}
    out=ROOT/args.output;out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
    for fid,f in records.items():
        print(fid,'doors:',len(f['doors']),'portals:',f['openingCountResolved'],'/',len(f['doors']),
              'max error pct:',max(abs(a['residualAtDisplayScalePct']) for a in f['calibrationChecks']))
    print('Saved',out,out.stat().st_size,'bytes')


if __name__=='__main__':main()
