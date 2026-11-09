export type SecurityMode='disarmed'|'home'|'away'
export type SecurityState={gate:number;gateTarget:boolean;garage:number;garageTarget:boolean;car:number;carTarget:0|1|null;mode:SecurityMode;alarm:boolean;message:string;events:{id:number;text:string;at:number}[];serial:number;garageCloseAt:number|null;clock:number}
export type SecurityAction={type:'tick';dt:number;now?:number}|{type:'gate'|'garage';open:boolean}|{type:'car';target:0|1|null}|{type:'arm';mode:SecurityMode}|{type:'motion'}|{type:'ack'}
export const initialSecurity=():SecurityState=>({gate:0,gateTarget:false,garage:0,garageTarget:false,car:0,carTarget:null,mode:'disarmed',alarm:false,message:'',events:[],serial:0,garageCloseAt:null,clock:Date.now()})
function event(s:SecurityState,text:string):SecurityState{const id=s.serial+1;return{...s,message:text,serial:id,events:[{id,text,at:Date.now()},...s.events].slice(0,12)}}
export function securityReducer(s:SecurityState,a:SecurityAction):SecurityState{
 if(a.type==='tick'){
  const step=Math.max(0,Math.min(a.dt,.25)),toward=(v:number,t:number,speed:number)=>Math.abs(t-v)<step*speed?t:v+Math.sign(t-v)*step*speed
  const gate=toward(s.gate,s.gateTarget?1:0,.35),garage=toward(s.garage,s.garageTarget?1:0,.30)
  let car=s.car,carTarget=s.carTarget,gateTarget=s.gateTarget,garageTarget=s.garageTarget,garageCloseAt=s.garageCloseAt
  const now=a.now??Date.now(),clock=garageCloseAt!==null?Math.max(s.clock,Math.floor(now/1000)*1000):s.clock
  const clearedEntry=carTarget===1&&car>=.24&&!gateTarget
  if(carTarget!==null&&garage===1&&(gate===1||clearedEntry)){car=toward(car,carTarget,.09);if(car===carTarget)carTarget=null}
  // The vehicle has cleared the entrance with its full length; close behind it.
  if(s.carTarget===1&&car>=.24)gateTarget=false
  const completed=s.carTarget!==null&&carTarget===null
  if(completed){gateTarget=false;garageCloseAt=now+120000}
  if(garageCloseAt!==null&&now>=garageCloseAt&&carTarget===null&&(car===0||car===1)){garageTarget=false;garageCloseAt=null}
  if(gate===s.gate&&garage===s.garage&&car===s.car&&carTarget===s.carTarget&&gateTarget===s.gateTarget&&garageTarget===s.garageTarget&&garageCloseAt===s.garageCloseAt&&clock===s.clock)return s
  const next={...s,gate,garage,car,carTarget,gateTarget,garageTarget,garageCloseAt,clock:completed?now:clock}
  if(completed)return event(next,car===1?'Автомобиль в гараже':'Автомобиль выехал')
  return s.garageCloseAt!==null&&garageCloseAt===null?event(next,'Гараж закрывается по таймеру'):next
 }
 if(a.type==='gate'||a.type==='garage'){
  if(s.mode!=='disarmed')return event(s,'Сначала снимите охрану')
  if(!a.open&&(s.carTarget!==null||(s.car>0&&s.car<1)))return event(s,'Проезд занят автомобилем')
  return event({...s,[a.type+'Target']:a.open,...(a.type==='garage'?{garageCloseAt:null}:{})},a.type==='gate'?(a.open?'Въездные ворота открываются':'Въездные ворота закрываются'):(a.open?'Гараж открывается':'Гараж закрывается'))
 }
 if(a.type==='car'){
  if(s.mode!=='disarmed')return event(s,'Сначала снимите охрану')
  if(a.target===null)return event({...s,carTarget:null},'Автомобиль остановлен')
  if(s.car===a.target)return event(s,a.target===1?'Автомобиль уже в гараже':'Автомобиль уже снаружи')
  return event({...s,carTarget:a.target,gateTarget:true,garageTarget:true,garageCloseAt:null},a.target===1?'Заезд: открываем ворота':'Выезд: открываем ворота')
 }
 if(a.type==='arm'){
  if(a.mode!=='disarmed'&&(s.gate>0||s.garage>0||s.gateTarget||s.garageTarget||s.carTarget!==null||(s.car>0&&s.car<1)))return event(s,'Закройте ворота и освободите проезд')
  return event({...s,mode:a.mode,alarm:false},a.mode==='disarmed'?'Охрана снята':a.mode==='home'?'Периметр под охраной':'Дом под охраной')
 }
 if(a.type==='motion')return event({...s,alarm:s.mode!=='disarmed'||s.alarm},s.mode==='disarmed'?'Демо: движение у въезда':'Демо: тревога на периметре')
 return event({...s,alarm:false},'Тревога подтверждена')
}
export const virtualCameras=[
 {id:'gate',name:'Въезд',position:[30.2,3.1,35.6],target:[12,1.7,12],base:-.22},
 {id:'garage',name:'Гараж',position:[17.4,3.2,19.8],target:[19.5,1.1,11.7],base:-.22},
 {id:'entry',name:'Главный вход',position:[-4.8,3.2,7.4],target:[-1,1.3,3.8],base:-.22},
 {id:'terrace',name:'Терраса',position:[15.3,6,7.5],target:[0,3.5,4.8],base:-.22},
 {id:'garden',name:'Сад',position:[-18,3.2,28],target:[-12,.4,20],base:-.22},
 {id:'rear',name:'Задний периметр',position:[17,6,-9],target:[3,3.2,-6],base:2.9},
] as const
