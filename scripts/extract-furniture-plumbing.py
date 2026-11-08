#!/usr/bin/env python3
"""Reproduce registered 2D furniture and plumbing source-art without manual tracing.
The PDF itself is not redistributed. Only cropped SVG art of plan views is exported.
"""
from __future__ import annotations
import base64, fitz, gzip, glob, json, re
from pathlib import Path
from lxml import etree

ROOT=Path(__file__).resolve().parent.parent
import os, sys
PDF=Path(os.environ.get('VILLA_COMO_SOURCE_PDF', sys.argv[1] if len(sys.argv)>1 else '/mnt/data/!!!_Вилла_Комо_09_02_26_общий_файл_1.pdf'))
if not PDF.is_file(): raise SystemExit('Provide PDF file via VILLA_COMO_SOURCE_PDF or first command-line argument')
D=fitz.open(PDF)
plans=json.loads((ROOT/'src/data/architectural-plans.json').read_text())['floors']
svg_ns='{http://www.w3.org/2000/svg}'

# Diagram crops; these are strictly source-art crops, not reconstructed 3D coordinates.
# Floor-plan shifts are independently confirmed against common source-wall geometries.
FURNITURE=[('garage',18),('level-1',19),('level-2',20),('level-3',21)]
# Detail sheet crops include plumbing top views and connection annotations; remove all title/address/table areas.
PLUMBING={
 'A-22': {'page':22,'crop':[85,123,780,450], 'floor':'garage','rooms':[2,5],'title':'Гараж · санузел и лаборатория'},
 'A-23': {'page':23,'crop':[75,112,790,455], 'floor':'level-1','rooms':[3,7],'title':'Апартаменты · кухня и санузел'},
 'A-24': {'page':24,'crop':[80,105,745,485], 'floor':'level-1','rooms':[8,9],'title':'Первый этаж · хозяйственная и постирочная'},
 'A-25': {'page':25,'crop':[85,95,800,530], 'floor':'level-1','rooms':[12,16,18],'title':'Первый этаж · кабинет, персонал и кухня'},
 'A-26': {'page':26,'crop':[85,96,650,515], 'floor':'level-2','rooms':[4],'title':'Второй этаж · мастер-санузел'},
 'A-27': {'page':27,'crop':[160,105,520,540], 'floor':'level-2','rooms':[6],'title':'Второй этаж · гостевой санузел'},
 'A-28': {'page':28,'crop':[135,105,700,510], 'floor':'level-2','rooms':[10,12],'title':'Второй этаж · санузел и кухня'},
 'A-29': {'page':29,'crop':[185,120,665,505], 'floor':'level-3','rooms':[4],'title':'Третий этаж · санузел'},
}

def derive_source_svg(page_num: int, crop: fitz.Rect, strip_all_text=False)->str:
    page=D[page_num-1]
    page.set_cropbox(crop)
    raw=page.get_svg_image(text_as_path=False)
    root=etree.fromstring(raw.encode('utf-8'))
    # Never publish raster materials and photos; furniture art is primarily SVG strokes/paths.
    for node in list(root.iter()):
        tag=etree.QName(node.tag).localname
        if tag=='image' or (tag=='text' and strip_all_text):
            parent=node.getparent()
            if parent is not None: parent.remove(node)
        elif tag=='text':
            # The PDF renderer emits full-sheet text even after setting a cropbox.
            # Retain ONLY text whose glyph baseline falls inside the published crop.
            span=next((part for part in node.iter() if etree.QName(part.tag).localname=='tspan'),None)
            coords=re.search(r'matrix\(([^)]+)\)',node.get('transform',''))
            if span is None or coords is None:
                node.getparent().remove(node);continue
            values=[float(x) for x in re.split(r'[ ,]+',coords.group(1).strip())]
            if len(values)!=6:
                node.getparent().remove(node);continue
            try:
                px=float(span.get('x','').split()[0]); py=float(span.get('y','').split()[0])
                a,b,c,d,e,f=values
                x=a*px+c*py+e; y=b*px+d*py+f
                keep=(-5<=x<=crop.width+5 and -5<=y<=crop.height+5)
            except (ValueError,IndexError): keep=False
            if not keep or any(t in ''.join(node.itertext()) for t in ('Italy, Como','MÈTRE','Адрес проекта','Название проекта')):
                node.getparent().remove(node)
    # Remove potential external hrefs except in-document #defs; no HTML or JS is embedded.
    for node in root.iter():
        for attr in list(node.attrib):
            if attr.lower().endswith('href') and not node.attrib[attr].startswith('#'):
                del node.attrib[attr]
    for node in root.iter():
        if etree.QName(node.tag).localname=='svg':
            node.set('data-source-page',str(page_num))
            node.set('data-source-art','not-millimetre-BIM')
    result=etree.tostring(root,encoding='unicode')
    if '<script' in result.lower() or '<image ' in result.lower():raise RuntimeError('unsafe source element')
    return result

def pack(s: str):
    return base64.b64encode(gzip.compress(s.encode(),compresslevel=9,mtime=0)).decode('ascii')

layers={}
for floor,pg in FURNITURE:
    data=plans[floor];ox,oy=data['cropOriginPts'];width=data['viewport']['width'];height=data['viewport']['height'];dx,dy=data['sourceShift']
    # pdf cropped artwork coordinates match architecture viewport after page registration
    crop=fitz.Rect(ox-dx,oy-dy,ox-dx+width,oy-dy+height)
    svg=derive_source_svg(pg,crop,strip_all_text=True)
    layers[floor]=pack(svg)
    out=ROOT/'_source_review';out.mkdir(exist_ok=True)
    (out/f'{floor}-furniture.svg').write_text(svg)
    print('FURNITURE',floor,'A-'+str(pg),'crop',crop,'raw',len(svg),'gz',len(gzip.compress(svg.encode(),mtime=0)), 'shifts',dx,dy)
(ROOT/'src/data/furniture-vectors.json').write_text(json.dumps(layers,ensure_ascii=False,separators=(',',':'))+'\n')

plumbing={}; meta={}
for sheet,details in PLUMBING.items():
    page=details['page']; crop=fitz.Rect(details['crop']);svg=derive_source_svg(page,crop,strip_all_text=False)
    plumbing[sheet]=pack(svg)
    meta[sheet]={'page':page,'floor':details['floor'],'rooms':details['rooms'],'title':details['title'],'viewport':{'width':crop.width,'height':crop.height},'sourceScale':'1:35 printed; not normalized across floor plan'}
    (ROOT/'_source_review'/f'{sheet}-plumbing.svg').write_text(svg)
    print('PLUMBING',sheet,'raw',len(svg),'gz',len(gzip.compress(svg.encode(),mtime=0)))
(ROOT/'src/data/plumbing-vectors.json').write_text(json.dumps(plumbing,ensure_ascii=False,separators=(',',':'))+'\n')

# Extract exact schedule wording and quantities as printed. Missing rows are NOT silently added.
registry={}
for sheet,details in PLUMBING.items():
    text=fitz.open(PDF)[details['page']-1].get_text()
    start=text.find('Спецификация сантехники')
    if start<0:raise RuntimeError('No specification on '+sheet)
    lines=text[start:].splitlines()
    rows=[];i=0
    while i<len(lines):
        entry=lines[i].strip()
        if re.fullmatch(r'\d{2}[аa]?',entry):
            mark=entry;i+=1;values=[]
            while i<len(lines) and not re.fullmatch(r'\d{2}[аa]?',lines[i].strip()):
                item=lines[i].strip()
                if item in ('1','2','3'):
                    qty=int(item);i+=1;break
                if item:values.append(item)
                i+=1
            else:
                raise RuntimeError('Missing quantity for '+sheet+' mark '+mark)
            rows.append({'mark':mark,'name':' '.join(values).replace('  ',' '),'quantity':qty,'sheet':sheet,'status':'specified'})
        else:i+=1
    # A-27 contains the plan mark 54 but its specification row is absent from readable PDF text.
    if sheet=='A-27':
        rows.insert(0,{'mark':'54','name':None,'quantity':None,'sheet':sheet,'status':'unresolved-row'})
    registry[sheet]={'sheet':sheet,'page':details['page'],'floor':details['floor'],'rooms':details['rooms'],'title':details['title'],'viewport':meta[sheet]['viewport'],'fixtures':rows,
      'confidence':'source-specifications','note':'Марки и наименования из таблицы PDF; координаты выводов показываются только на исходном листе, не перенесены в общий координатный базис.'}
    print('SPEC',sheet,len(rows),'count',sum(x['quantity'] or 0 for x in rows))
(ROOT/'src/data/plumbing-register.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
