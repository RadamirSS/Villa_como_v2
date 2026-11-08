"""Visual trace of lighting groups A-34..37. UI groups are not an electrical design.
Run against the original PDF. Pixel inputs refer to a 2200px-wide rendering.
Unspecified rooms remain explicitly demo-only, never invented project circuits.
"""
import json,re,sys
from pathlib import Path
import fitz
from shapely.geometry import Polygon as Poly
from shapely.ops import unary_union
R=Path(__file__).resolve().parents[1]
plans=json.loads((R/'src/data/architectural-plans.json').read_text())['floors']
pdf=fitz.open(sys.argv[1] if len(sys.argv)>1 else R.parent/'project_sources/01-_-_-_09_02_26_-_-_1.pdf')
shift={'garage':[0,0],'level-1':[0,-21.24],'level-2':[0,0],'level-3':[-3.96,7]}
groups=[];rooms=[]
def pt(f,p,width=2200):return [round(p[0]*1190.52001953125/width+shift[f][0],3),round(p[1]*1190.52001953125/width+shift[f][1],3)]
def group(f,r,mark,kind,name,points,source='drawing',path=False):
 groups.append(dict(id=f'{f}:{mark}',floor=f,room=r,mark=mark,kind=kind,name=name,sheet={'garage':'A-34','level-1':'A-35','level-2':'A-36','level-3':'A-37'}[f],evidence=source,pointsPt=[pt(f,p)for p in points],strip=path,dimmable=False))
def row(x1,x2,y,n):return [[round(x1+(x2-x1)*i/(n-1)),y]for i in range(n)] if n>1 else [[x1,y]]
def rect(x1,y1,x2,y2,nx=3,ny=2):return row(x1,x2,y1,nx)+[[x2,y1+(y2-y1)*i/(ny-1)]for i in range(1,ny)]+row(x2,x1,y2,nx)[1:]+[[x1,y2-(y2-y1)*i/(ny-1)]for i in range(1,ny-1)]
# Second floor, group marks preserved exactly. Different circuits in a room remain separate.
f='level-2'
for r,mark,kind,name,points,path in [
(1,'1.1','ceiling','Коридор · потолочные',rect(662,543,760,722,2,3),False),(1,'1.2','wall','Коридор · бра',[[705,452]],False),
(2,'2.1','ceiling','Гардеробная · потолочные',row(318,562,558,4)+row(318,562,614,4),False),(2,'2.2','led','Гардеробная · шкафы',[[286,507],[286,666],[624,525]],False),
(3,'3.1','ceiling','Мастер-спальня · потолочные',rect(558,805,794,979,3,2),False),(3,'3.2','pendant','Мастер-спальня · люстра',[[665,890]],False),(3,'3.3','wall','Мастер-спальня · изголовье',[[632,1014],[645,1014],[657,1014]],False),(3,'3.4','wall','Мастер-спальня · бра',[[511,807],[511,943],[836,976]],False),(3,'3.5','wall','Мастер-спальня · прикроватное слева',[[836,815]],False),(3,'3.6','wall','Мастер-спальня · прикроватное справа',[[836,942]],False),
(4,'4.1','led','Мастер-санузел · полки душа',[[278,1015],[459,1015]],True),(4,'4.2','pendant','Мастер-санузел · люстра',[[308,870]],False),(4,'4.3','wall','Мастер-санузел · бра',[[270,727],[382,781],[382,1006]],False),
(5,'5.1','pendant','Гостевая 1 · люстра',[[405,360]],False),(5,'5.2','ceiling','Гостевая 1 · потолочные',row(518,518,305,1)+[[518,334],[518,362],[518,391]],False),
(6,'6.1','ceiling','Гостевой санузел · потолочные',[[617,366],[655,366],[690,366]],False),(6,'6.2','led','Гостевой санузел · зеркало',[[562,260],[562,385]],True),(6,'6.3','wall','Гостевой санузел · бра',[[736,322],[736,368]],False),
(7,'7.1','pendant','Гостевая 2 · люстра',[[919,378]],False),(7,'7.2','ceiling','Гостевая 2 · потолочные',[[815,314],[815,378],[815,444]],False),
(8,'8.1','pendant','Гостиная · люстра у входа',[[1577,518]],False),(8,'8.2','ceiling','Гостиная · потолочные у входа',[[1577,458],[1517,518],[1636,518],[1577,576]],False),
(8,'8.3','pendant','Гостиная · люстра у столовой',[[1577,794]],False),(8,'8.4','ceiling','Гостиная · потолочные у столовой',[[1577,733],[1517,794],[1636,794],[1577,854]],False),
(8,'8.5','pendant','Гостиная · центральная люстра',[[1244,563]],False),(8,'8.6','ceiling','Гостиная · потолок по периметру',rect(1104,465,1385,661,5,3),False),
(8,'8.7','wall','Гостиная · бра',[[1102,399],[1428,399],[1686,464],[1686,852]],False),(8,'8.8','ceiling','Гостиная · потолочные у малой лестницы',[[919,551],[999,551],[999,594]],False),(8,'8.9','ceiling','Гостиная · потолочные у прохода',row(845,999,687,4),False),
(9,'9.1','ceiling','Прихожая · потолочные',row(1248,1352,315,4),False),(10,'10.1','ceiling','Санузел · потолочные',[[1143,289],[1143,342]],False),(10,'10.2','wall','Санузел · зеркало',[[1041,276],[1041,334]],False),
(11,'11.1','pendant','Столовая · люстра',[[1852,877]],False),(11,'11.2','led','Столовая · витрины и бра',rect(1778,721,1926,976,3,3),False),
(12,'12.1','ceiling','Кухня · потолочные',[[1803,287],[1899,287],[1962,329],[1962,375],[1962,427],[1803,375],[1803,425],[1803,477]],False),(12,'12.2','pendant','Кухня · свет над островом',[[1899,500]],False),(12,'12.3','led','Кухня · витрины',[[1723,295],[1978,478]],False),
(13,'Б.1','wall','Балкон · бра со стороны гостиной',[[978,788],[1280,788]],False),(13,'Б.2','wall','Балкон · бра со стороны столовой',[[2023,811],[2023,898]],False)]:group(f,r,mark,kind,name,points,path=path)
# First floor: only the documented right-hand wing has lighting design on A-35.
f='level-1'
for r,mark,kind,name,points,path in [
(8,'8.1','ceiling','Хозпомещение · потолочные',rect(685,307,747,418,2,3),False),(9,'9.1','ceiling','Постирочная · потолочные',rect(841,315,950,421,2,2),False),
(10,'10.1','pendant','Прихожая · люстра',[[1555,778]],False),(10,'10.2','wall','Прихожая и лестница · бра',[[1436,461],[1436,610],[1436,725]],False),
(11,'11.1','pendant','Кабинет · люстра',[[1275,634]],False),(11,'11.2','ceiling','Кабинет · потолочные',rect(1014,462,1365,695,4,3),False),(11,'11.3','wall','Кабинет · бра',[[1111,584],[1111,630],[1425,529],[1425,643]],False),(11,'11.4','wall','Кабинет · акценты',[[1120,510],[1051,583]],False),
(12,'12.1','ceiling','Санузел кабинета · потолочные',rect(850,529,931,580,2,2),False),(12,'12.2','led','Санузел кабинета · подсветка',[[820,515],[972,515]],True),
(13,'13.1','ceiling','Гардеробная · потолочные',row(1094,1388,298,5),False),(14,'14.1','ceiling','Спальня персонала 1 · потолочные',row(1497,1655,325,3),False),(15,'15.1','ceiling','Коридор персонала · потолочные',[[1755,315],[1755,433],[1755,530],[1755,629],[1755,725]],False),
(16,'16.1','ceiling','Кухня персонала · потолочные',row(1780,1957,874,4)+[[1761,970]],False),(16,'16.2','pendant','Кухня персонала · обеденный стол',[[1886,970]],False),(16,'16.3','led','Кухня персонала · рабочая столешница',[[1820,841],[1958,841]],True),
(17,'17.1','ceiling','Спальня персонала 2 · потолочные',rect(1807,642,1986,732,3,2),False),(17,'17.2','wall','Спальня персонала 2 · бра слева',[[1841,610]],False),(17,'17.3','wall','Спальня персонала 2 · бра справа',[[1986,610]],False),
(18,'18.1','ceiling','Санузел персонала · потолочные',[[1839,510],[1839,560],[1986,560]],False),(18,'18.2','led','Санузел персонала · подсветка',[[1848,475],[1990,475]],True),(18,'18.3','led','Санузел персонала · зеркало',[[1820,492]],False)]:group(f,r,mark,kind,name,points,path=path)
f='level-3'
for r,mark,kind,name,points,path in [
(1,'1.1','ceiling','Тамбур · потолочные',[[710,568],[710,623]],False),(2,'2.1','ceiling','Игровая · потолочные',[[707,692],[707,748],[707,805]],False),(2,'2.2','led','Игровая · мебель и кровать',[[515,525],[515,725]],True),(2,'2.bra','wall','Детская · бра с собственным выключателем',[[623,385]],False),
(3,'3.1','ceiling','Спальня · потолочные',row(1185,1297,538,3),False),(3,'3.2','led','Спальня · мебель',[[973,525],[1357,510],[1357,708]],False),(3,'3.bra','wall','Спальня · бра с собственным выключателем',[[1170,687],[1338,687]],False),
(4,'4.1','ceiling','Санузел · потолочные',row(659,787,517,4),False),(4,'4.2','led','Санузел · зеркало',[[647,530],[821,530]],True),
(5,'5.1','ceiling','Техническое · группа 5.1',[[552,902]],False)]:group(f,r,mark,kind,name,points,source='drawing-label-only' if mark=='5.1' else 'drawing-symbol-only' if '.bra'in mark else 'drawing',path=path)
f='garage'
for r,mark,kind,name,points in [(1,'ceiling','ceiling','Гараж · потолочные',[[605,589],[879,589],[1147,589],[605,785],[879,785],[1147,785]]),(1,'perimeter','wall','Гараж · свет по периметру',[[637,495],[901,495],[446,785],[1254,785]]),(2,'lab','pendant','Лаборатория · потолочный',[[539,391]]),(3,'pantry','pendant','Склад продуктов · потолочный',[[751,391]]),(4,'storage','pendant','Кладовая · потолочный',[[964,391]]),(7,'cellar','wall','Винный погреб · бра',[[1419,836],[1660,842],[1422,985],[1377,1034]])]:group(f,r,mark,kind,name,points,source='drawing-unmarked-circuit')
# Explicit room visual footprints traced from A-18..21 at 1800px width.
zones={
'garage':{1:[[245,405],[1040,405],[1040,786],[360,786],[360,522],[245,522]],2:[359,253,524,388],3:[534,253,697,389],4:[709,253,871,389],5:[246,648,351,784],6:[245,527,351,640],7:[[1154,603],[1367,610],[1367,771],[1190,766],[1110,858],[1090,839],[1154,733]]},
'level-1':{1:[656,553,794,603],2:[[477,553],[640,553],[640,630],[675,630],[675,835],[477,835]],3:[[219,611],[333,611],[333,797],[219,797],[164,775],[140,725],[152,680],[183,648],[219,642]],4:[225,410,462,598],5:[477,409,642,538],6:[389,214,520,387],7:[221,214,381,387],8:[529,214,644,397],9:[654,214,828,397],10:[[1197,312],[1385,312],[1385,744],[1180,744],[1180,613],[1197,613]],11:[840,315,1169,609],12:[655,408,797,482],13:[845,159,1186,300],14:[1196,159,1382,301],15:[[1408,253],[1460,253],[1460,663],[1406,663],[1406,744],[1390,744],[1390,314],[1408,314]],16:[1408,663,1650,833],17:[1472,493,1652,652],18:[1472,391,1653,483],19:[1515,213,1617,376]},
'level-2':{1:[[528,410],[641,410],[641,558],[528,558]],2:[221,408,519,556],3:[422,666,628,833],4:[[220,560],[414,560],[414,834],[220,834],[174,796],[141,735],[140,671],[174,608],[220,582]],5:[221,221,412,397],6:[454,221,612,397],7:[665,221,835,397],8:[[850,312],[1387,312],[1387,837],[1304,837],[1304,620],[1169,620],[1169,606],[850,606],[850,557],[655,557],[655,410],[850,410]],9:[979,213,1148,301],10:[848,213,973,301],11:[1406,555,1644,835],12:[1407,217,1633,530],13:[650,615,1162,832]},
'level-3':{1:[[565,447],[738,447],[738,533],[565,533]],2:[[424,303],[520,303],[520,444],[556,444],[556,542],[738,542],[738,823],[538,823],[538,637],[424,637]],3:[[680,315],[1115,315],[1115,583],[922,583],[922,438],[680,438]],4:[529,315,671,432],5:[398,646,527,822]}}
for f,rs in zones.items():
 for n,poly in rs.items():
  if len(poly)==4 and isinstance(poly[0],int):x,y,xx,yy=poly;poly=[[x,y],[xx,y],[xx,yy],[x,yy]]
  # Furniture pages use the existing sourceShift; A-37's x registration differs by .36 pt.
  xy=[[round(x*1190.52001953125/1800+plans[f]['sourceShift'][0],3),round(y*1190.52001953125/1800+plans[f]['sourceShift'][1],3)]for x,y in poly]
  room=next(r for r in plans[f]['rooms']if r['number']==n)
  rooms.append(dict(id=f'{f}:{n}',floor=f,number=n,name=room['name'],polygonPt=xy,sourceSheet=plans[f]['furnitureSheet'],evidence='visual-room-footprint'))
  if not any(g['floor']==f and g['room']==n for g in groups):
   centre=[sum(p[0]for p in xy)/len(xy),sum(p[1]for p in xy)/len(xy)]
   groups.append(dict(id=f'{f}:demo-{n}',floor=f,room=n,mark='демо',kind='ceiling',name='Общий свет · демо',sheet={'garage':'A-34','level-1':'A-35','level-2':'A-36','level-3':'A-37'}[f],evidence='demo-unresolved',pointsPt=[centre],strip=False,dimmable=False))
# Clip presentation fills to the actual registered footprint and subtract source walls.
# This prevents a rough visual zone from lighting the open courtyard or a wall.
spatial=json.loads((R/'src/data/spatial-model.json').read_text())['floors']
exterior=json.loads((R/'src/data/exterior-concept.json').read_text())
for room in rooms:
 f=room['floor'];n=room['number']
 outline=exterior['terrace']['polygonPt'] if f=='level-2'and n==13 else exterior['garageAppendix']['outlinePt'] if f=='garage'and n==7 else exterior['floors'][f]['outlinePt']
 walls=unary_union([Poly(w['outer'],w['holes']).buffer(0)for w in spatial[f]['wallPolygonsPt']])
 clipped=Poly(room['polygonPt']).buffer(0).intersection(Poly(outline).buffer(0)).difference(walls)
 pieces=list(clipped.geoms) if hasattr(clipped,'geoms')else[clipped]
 room['fillPolygonsPt']=[{'outer':[[round(x,3),round(y,3)]for x,y in q.exterior.coords[:-1]],'holes':[[[round(x,3),round(y,3)]for x,y in h.coords[:-1]]for h in q.interiors]}for q in pieces if q.geom_type=='Polygon'and q.area>1]
# Text-labelled switch combinations preserve multi-location and cross-room controls.
controls=[]
for f,n in [('garage',34),('level-1',35),('level-2',36),('level-3',37)]:
 for block in pdf[n-1].get_text('dict')['blocks']:
  for line in block.get('lines',[]):
   for span in line['spans']:
    raw=span['text'].strip();clean=raw.replace(' ','').replace('+.','+')
    if clean.startswith('Гр.') or clean.startswith('гр.'):continue
    targetfloor='level-1' if '1эт' in clean else f
    refs=re.findall(r'(?<!\d)(?:\d+|Б)\.\d+',clean)
    if not refs or not re.fullmatch(r'[\dБ.+=+()этЛестница ]+',clean):continue
    targets=[f'{targetfloor}:{ref}'for ref in refs if any(g['id']==f'{targetfloor}:{ref}'for g in groups)]
    if targets:
     controls.append(dict(id=f'{f}:switch-{len(controls)+1}',floor=f,label=raw,groups=list(dict.fromkeys(targets)),sourceSheet=f'A-{n}',positionPt=pt(f,[((span['bbox'][0]+span['bbox'][2])/2)*2200/1190.52001953125,span['bbox'][1]*2200/1190.52001953125]),evidence='printed-control-label',note='Лестница: дополнительная связь требует сверки' if 'Лестница'in raw else ''))
# A-34 gate contact note explicitly switches garage light; not a new invented relay circuit.
controls.append(dict(id='garage:gate-sensor',floor='garage',label='Датчик открытия ворот',groups=['garage:ceiling'],sourceSheet='A-34',positionPt=pt('garage',[879,943]),evidence='drawing-gate-contact',note='Демонстрация сигнала датчика; физические ворота не подключены'))
out=dict(schema='villa-lighting/1',sourceSheets=['A-34','A-35','A-36','A-37'],groups=groups,rooms=rooms,controls=controls,notes=['Левая часть A-35 не содержит проектных групп: соответствующие комнаты имеют явно обозначенный демо-свет.','Связи групп в 3D условные, не кабельные трассы. Сечения, защиты, щит и протоколы управления не назначены.','Типы и координаты светильников визуально перенесены с плана; марки и подтверждение количества требуют ведомостей. Диммирование не подтверждено.'])
(R/'src/data/lighting-plan.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(len(groups),'groups',sum(len(g['pointsPt'])for g in groups),'visual light anchors',len(controls),'control labels',len(rooms),'room zones')
