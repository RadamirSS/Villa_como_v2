#!/usr/bin/env python3
"""Derive *provisional* 3D extrusion footprints directly from rendered MÈTRE A-14..A-17.

The source drawing is authoritative for 2D graphic contours; heights, slab envelope,
and metric calibration are NOT authoritatively specified here. No PDF is published.

Requirements (offline authoring only): pymupdf, numpy, opencv-python.
Usage: python scripts/build-spatial-model.py /private/path/to/owner-source.pdf
"""
import argparse, json, hashlib, math
from pathlib import Path
import numpy as np
import cv2
import fitz

ROOT=Path(__file__).resolve().parent.parent
DRAWINGS=json.loads((ROOT/'src/data/architectural-plans.json').read_text())['floors']
INDEX={f:int(v['finalPage']) for f,v in DRAWINGS.items()}
SOURCE_GRAY=100
RENDER_DPI_SCALE=3
PDF_POINTS_PER_METER=36.4


def simplify_contour(c, eps=1.2):
    c=cv2.approxPolyDP(c, eps, True).reshape(-1,2).astype(float)
    return c.tolist() if len(c)>=3 else []


def ring_points(c, x0, y0, scale):
    out=[]
    for x,y in c:
        p=[round(x0+x/scale,2),round(y0+y/scale,2)]
        if not out or p!=out[-1]:out.append(p)
    return out if len(out)>=3 else []


def polys_from_mask(mask, page_rect, min_outer=70, min_hole=120):
    contours,hierarchy=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:return []
    hier=hierarchy[0]
    result=[]
    for i,h in enumerate(hier):
        if int(h[3])!=-1 or cv2.contourArea(contours[i])<min_outer:continue
        outer=ring_points(simplify_contour(contours[i], 1.3),page_rect.x0,page_rect.y0,RENDER_DPI_SCALE)
        if not outer:continue
        holes=[]
        child=int(h[2])
        while child!=-1:
            if cv2.contourArea(contours[child])>=min_hole:
                ring=ring_points(simplify_contour(contours[child],1.3),page_rect.x0,page_rect.y0,RENDER_DPI_SCALE)
                if ring:holes.append(ring)
            child=int(hier[child][0])
        result.append({'outer':outer,'holes':holes})
    return result


def build_floor(doc, floor):
    d=DRAWINGS[floor]
    page=doc[d['finalPage']-1]
    ox,oy=d['cropOriginPts']; vw=d['viewport']['width']; vh=d['viewport']['height']
    # Clip exactly the previously published Stage-1/2 source viewport; do not include the title blocks.
    clip=fitz.Rect(ox,oy,ox+vw,oy+vh) & page.rect
    pix=page.get_pixmap(matrix=fitz.Matrix(RENDER_DPI_SCALE,RENDER_DPI_SCALE),clip=clip,alpha=False)
    a=np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height,pix.width,3)
    dark=np.logical_and.reduce((a[:,:,0]>=96,a[:,:,0]<=104,np.abs(a[:,:,0].astype('int16')-a[:,:,1].astype('int16'))<3,np.abs(a[:,:,1].astype('int16')-a[:,:,2].astype('int16'))<3)).astype('uint8')*255
    # Small glyph antialias islands are removed by area filtering, preserving true gray wall fills.
    wall_polygons=polys_from_mask(dark,clip,min_outer=70,min_hole=120)
    clean=np.zeros_like(dark)
    # Reconstruct purely for the indicative floor platform (not a CAD slab).
    cnt,h=cv2.findContours(dark,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    for c in cnt:
        if cv2.contourArea(c)>=70:cv2.drawContours(clean,[c],0,255,thickness=cv2.FILLED)
    radius=int(round(.58*PDF_POINTS_PER_METER*RENDER_DPI_SCALE))
    if radius%2==0:radius+=1
    kernel=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(radius,radius))
    joined=cv2.morphologyEx(clean,cv2.MORPH_CLOSE,kernel)
    slab_polygons=polys_from_mask(joined,clip,min_outer=1200,min_hole=15000)
    # Platform is a visual footprint, not just the wall ribbons: fill internal openings.
    # Inset courtyards remain unverified and this platform MUST NOT be exported as CAD.
    for slab in slab_polygons: slab['holes']=[]
    # The broad outlines are approximate contextual platforms; never use in CAD or construction.
    npoints=sum(len(p['outer'])+sum(len(h) for h in p['holes']) for p in wall_polygons)
    return {'sourceSheet':d['finalSheet'],'sourcePage':d['finalPage'],'sourceViewport':{'xPt':ox,'yPt':oy,'widthPt':vw,'heightPt':vh},
      'wallPolygonsPt':wall_polygons,'slabEnvelopePt':slab_polygons,
      'wallSource':'thresholded source PDF RGB(100,100,100) fills, contour trace at 3 px/pdf-pt; approximate sampling tolerance <= 0.7 PDF points',
      'slabSource':'visual-only footprint inferred by morphological closing; NOT a project slab / not approved topology',
      'status':'source-derived-provisional','wallPolygonCount':len(wall_polygons),'wallVertexCount':npoints}


def main():
    ap=argparse.ArgumentParser();ap.add_argument('pdf');ap.add_argument('--output',default='src/data/spatial-model.json');args=ap.parse_args()
    with fitz.open(args.pdf) as doc:
        if len(doc)!=94:raise ValueError('Source mismatch: expected original 94-page MÈTRE file')
        model={'schema':'villa-como-v2/visual-3d/1','sourceDocument':'MÈTRE Villa Como working drawings, 94 pp.',
          'sourceMethod':'Colored source wall fills on A-14..17 rasterized at 3 pixels/PDF-point, traced as polygons (unconfirmed architectural height)',
          'coordinateSpace':'source PDF points, common page registration, converted only for visual Three.js display',
          'calibration':{'pointsPerMeter':PDF_POINTS_PER_METER,'confidence':'approximate 2D scale from A-15 reference 8465 mm / ~308.4 PDF pt and 5790 mm / ~209.5 pt','approvedForConstruction':False},
          'displayAssumptions':{'wallHeightM':2.65,'slabThicknessM':0.15,'level3BaseM':5.9,'garageLocation':'unknown: render separately, not placed next to house','roof':'not available','doorVoids':'present only if source wall fill has a gap; markers not reconstructed'},
          'floors':{f:build_floor(doc,f) for f in INDEX}}
    out=ROOT/args.output;out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(model,ensure_ascii=False,separators=(',',':'))+'\n')
    print('Source PDF sha256:',hashlib.sha256(Path(args.pdf).read_bytes()).hexdigest()[:16])
    for f,v in model['floors'].items():print(f,v['wallPolygonCount'],'wall polygons /',v['wallVertexCount'],'vertices /',len(v['slabEnvelopePt']),'slab visual polygons')
    print('Wrote',out,round(out.stat().st_size/1024),'KiB')
if __name__=='__main__':main()
