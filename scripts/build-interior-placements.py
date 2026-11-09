"""Explicit visual trace of A-18..21 at 1800px page width. No room-centroid placement.
Approximate symbol footprints, not a certified furniture survey. Original PDF stays private.
"""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
plans=json.loads((R/'src/data/architectural-plans.json').read_text())['floors']
items=[]
def add(f,room,kind,bbox,head='north',sheet=None,marks=None):
 dx,dy=plans[f]['sourceShift'];scale=1190.52001953125/1800
 x0,y0,x1,y1=bbox
 items.append({'id':f'{f}-{kind}-{len(items)+1:03d}','floor':f,'room':room,'kind':kind,'sourceSheet':plans[f]['furnitureSheet'],'sourceBBoxPx':bbox,'centrePt':[(x0+x1)/2*scale+dx,(y0+y1)/2*scale+dy],'sizeM':[(x1-x0)*scale/36.4,(y1-y0)*scale/36.4],'head':head,'specSheet':sheet,'specMarks':marks or [],'polygonPt':None,'positionStatus':'visually-traced-plan-symbol','dimensionsStatus':'source-symbol-footprint-approximate','modelStatus':'simplified-procedural-3d'})
def rows(f,entries):
 for room,kind,box,*head in entries:add(f,room,kind,box,head[0] if head else 'north')
rows('garage',[
(2,'counter',[359,253,390,388]),(2,'counter',[390,253,484,285]),(2,'cabinet',[484,253,524,388]),(2,'hob',[395,256,423,283]),
(3,'shelf',[534,253,568,389]),(3,'shelf',[662,253,697,389]),(4,'shelf',[709,253,871,291]),(4,'shelf',[838,291,871,389]),
(1,'shelf',[879,376,1035,398]),(1,'cabinet',[246,427,279,490]),(6,'cabinet',[241,527,350,546]),(6,'cabinet',[241,621,350,639]),
(7,'wineRack',[1154,603,1367,640]),(7,'wineRack',[1204,734,1367,772])])
rows('level-1',[
(4,'rug',[234,438,395,599]),(4,'bed',[266,485,364,590],'south'),(4,'nightstand',[238,564,270,596]),(4,'nightstand',[363,564,393,596]),
(5,'cabinet',[480,409,642,438]),(5,'cabinet',[480,508,642,539]),(6,'cabinet',[390,215,480,245]),(6,'cabinet',[490,215,521,310]),(6,'cabinet',[493,310,521,387]),
(7,'counter',[223,214,381,238]),(8,'counter',[529,216,643,247]),(8,'cabinet',[617,252,644,339]),(8,'cabinet',[576,365,612,396]),(8,'cabinet',[534,366,574,393]),
(9,'counter',[655,367,746,398]),(9,'cabinet',[746,367,795,398]),(9,'cabinet',[655,224,691,319]),
(2,'sofa',[484,566,607,686],'north'),(2,'coffeeTable',[484,639,545,696]),(2,'diningTable',[480,758,592,805]),(2,'cabinet',[640,638,675,835]),(2,'armchair',[490,586,546,629]),
(11,'sofa',[891,321,1147,343]),(11,'desk',[967,398,1071,451]),(11,'officeChair',[938,404,962,440]),(11,'coffeeTable',[1017,472,1058,508]),(11,'armchair',[1057,503,1114,555]),(11,'diningTable',[882,481,916,581]),(11,'cabinet',[840,483,881,513]),
(13,'cabinet',[1018,159,1185,187]),(13,'cabinet',[847,266,1185,299]),(13,'cabinet',[1188,159,1242,189]),(14,'bed',[1248,161,1356,215],'north'),(14,'nightstand',[1221,161,1245,189]),
(10,'bench',[1230,699,1310,735]),(10,'cabinet',[1353,644,1387,745]),(15,'cabinet',[1452,234,1476,361]),
(17,'bed',[1526,499,1603,605],'north'),(17,'nightstand',[1475,491,1521,520]),(17,'nightstand',[1607,491,1650,520]),(17,'cabinet',[1474,630,1650,653]),
(16,'counter',[1468,663,1648,693]),(16,'hob',[1567,665,1593,690]),(16,'diningTable',[1522,766,1556,810]),(16,'sofa',[1408,746,1446,824]),
(3,'counter',[217,785,316,809]),(3,'counter',[300,646,334,786]),(3,'hob',[155,645,185,679])])
rows('level-2',[
(5,'rug',[220,229,364,370]),(5,'bed',[222,245,333,346],'west'),(5,'nightstand',[223,230,248,247]),(5,'nightstand',[223,349,248,371]),(5,'desk',[283,371,394,396]),
(7,'rug',[680,263,835,388]),(7,'bed',[723,279,804,382],'south'),(7,'nightstand',[688,353,717,385]),(7,'nightstand',[810,353,833,385]),(7,'desk',[714,223,787,245]),
(2,'cabinet',[221,408,412,439]),(2,'cabinet',[477,410,519,552]),(2,'cabinet',[286,533,394,556]),(2,'cabinet',[391,440,419,536]),
(3,'rug',[477,657,627,833]),(3,'bed',[492,683,604,786],'south'),(3,'bench',[488,813,620,837]),(3,'nightstand',[477,774,490,795]),(3,'nightstand',[610,774,628,798]),(3,'cabinet',[424,666,450,804]),
(4,'counter',[297,651,326,742]),(4,'cabinet',[340,626,408,652]),(4,'cabinet',[424,672,449,781]),
(8,'sofa',[889,389,1040,445]),(8,'armchair',[1067,403,1110,449]),(8,'armchair',[1067,499,1110,542]),(8,'coffeeTable',[890,460,947,517]),(8,'roundTable',[982,470,1024,512]),(8,'roundTable',[1006,452,1028,474]),
(8,'armchair',[790,463,820,502]),(1,'cabinet',[613,416,642,558]),(1,'console',[739,435,787,460]),
(9,'bench',[1066,215,1142,235]),(9,'cabinet',[983,215,1047,245]),(10,'counter',[852,223,884,298]),
(11,'diningTable',[1475,651,1534,792]),(11,'cabinet',[1610,555,1643,598]),(11,'cabinet',[1591,637,1621,792]),
(12,'counter',[1407,217,1633,249]),(12,'counter',[1595,249,1633,530]),(12,'counter',[1406,325,1438,519]),(12,'island',[1476,387,1560,440]),(12,'hob',[1530,219,1556,245])])
rows('level-3',[
(2,'bed',[425,303,520,405],'north'),
(3,'bed',[798,319,906,381],'east'),(3,'nightstand',[769,317,794,343]),(3,'cabinet',[682,316,765,349]),(3,'cabinet',[792,422,920,437]),(3,'sofa',[966,505,1097,562],'south'),(3,'cabinet',[921,497,958,560]),
(2,'desk',[428,528,462,597]),(2,'officeChair',[464,540,487,566]),(2,'desk',[617,542,687,578]),(2,'officeChair',[651,579,678,603]),(2,'cabinet',[520,449,553,539]),(2,'sofa',[662,648,718,786],'east'),(2,'cabinet',[539,802,738,823]),(2,'cabinet',[540,667,566,787]),
(4,'counter',[530,409,578,432])])
# Seats read from the plan around each dining table, not scattered at room centres.
for f,room,points in [
 ('level-1',2,[(503,747),(553,747),(503,813),(553,813),(477,780),(594,780)]),('level-1',16,[(1539,757),(1539,817),(1514,788),(1566,788)]),
 ('level-1',11,[(867,542),(940,542)]),('level-2',11,[(1460,678),(1460,720),(1460,762),(1548,678),(1548,720),(1548,762),(1503,639),(1503,805)]),('level-2',12,[(1491,375),(1535,375),(1491,452),(1535,452)])]:
 for x,y in points:add(f,room,'chair',[x-10,y-10,x+10,y+10])
add('level-1',8,'washer',[533,216,571,250])
add('level-1',8,'washer',[574,216,612,250])
# Each physical sanitary assembly links all its scheduled components: hidden
# cisterns/control trims remain associated rather than being extra floor objects.
def fixture(f,room,kind,box,sheet,marks):add(f,room,kind,box,sheet=sheet,marks=marks)
fixture('garage',2,'sink',[360,322,389,351],'A-22',['08','09'])
fixture('garage',5,'sink',[323,729,348,758],'A-22',['01','02'])
fixture('garage',5,'toilet',[255,648,284,675],'A-22',['03','04','05'])
fixture('garage',5,'shower',[305,648,351,704],'A-22',['06','07'])
fixture('level-1',3,'sink',[155,753,180,778],'A-23',['10','11'])
for box in [[263,217,294,237],[311,217,343,237]]:fixture('level-1',7,'sink',box,'A-23',['12','13'])
fixture('level-1',7,'shower',[224,239,297,326],'A-23',['14','15','16а','17а'])
fixture('level-1',7,'toilet',[246,358,268,386],'A-23',['18','19','20'])
fixture('level-1',8,'sink',[618,302,642,330],'A-24',['21','22'])
fixture('level-1',9,'sink',[698,369,729,393],'A-24',['23','24'])
fixture('level-1',9,'toilet',[805,319,829,346],'A-24',['25','26','27'])
fixture('level-1',12,'sink',[748,416,777,444],'A-25',['28','29'])
fixture('level-1',12,'toilet',[685,414,710,443],'A-25',['30','31','32'])
fixture('level-1',18,'sink',[1487,392,1520,417],'A-25',['33','34'])
fixture('level-1',18,'toilet',[1557,392,1582,420],'A-25',['35','36','37'])
fixture('level-1',18,'shower',[1611,443,1653,482],'A-25',['38','39'])
fixture('level-1',16,'sink',[1506,665,1533,690],'A-25',['40','41'])
for box in [[299,672,322,700],[299,718,322,741]]:fixture('level-2',4,'sink',box,'A-26',['42','43'])
fixture('level-2',4,'shower',[221,559,346,617],'A-26',['44','45','46','47','48'])
fixture('level-2',4,'bath',[174,681,216,780],'A-26',['49','50'])
fixture('level-2',4,'toilet',[344,622,371,650],'A-26',['51','52','53'])
fixture('level-2',6,'sink',[587,267,611,298],'A-27',['54','55'])
fixture('level-2',6,'toilet',[461,282,485,311],'A-27',['56','57','58'])
fixture('level-2',6,'shower',[488,218,546,269],'A-27',['59','60','61','62'])
fixture('level-2',10,'sink',[855,241,880,276],'A-28',['63','64'])
fixture('level-2',10,'toilet',[923,215,946,244],'A-28',['65','66','67'])
fixture('level-2',12,'sink',[1596,277,1624,307],'A-28',['68'])
fixture('level-3',4,'sink',[539,412,568,431],'A-29',['69','70'])
fixture('level-3',4,'toilet',[597,368,623,389],'A-29',['71','72','73'])
fixture('level-3',4,'shower',[584,391,671,432],'A-29',['74','75'])
add('level-1',3,'counter',[136,643,315,809])
poly=[[181,643],[217,643],[217,676],[180,691],[161,724],[174,761],[220,785],[315,785],[315,809],[213,809],[163,783],[136,748],[142,699]]
dx,dy=plans['level-1']['sourceShift'];items[-1]['polygonPt']=[[x*1190.52001953125/1800+dx,y*1190.52001953125/1800+dy]for x,y in poly]
out={'schema':'villa-interior-placements/1','sourceImageWidthPx':1800,'sourcePages':[18,19,20,21],'accuracy':'visual symbol trace; requires independent metric acceptance','items':items,'unresolved':[{'sheet':'A-27','mark':'54','note':'Basin visible on A-20; its specification row is missing. Geometry is from the plan, product identity unconfirmed.'}]}
(R/'src/data/interior-placements.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(len(items),'explicit 3D placements')
