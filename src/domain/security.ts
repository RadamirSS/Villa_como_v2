export type SecurityMode='disarmed'|'home'|'away'
export type SecurityState={gate:number;gateTarget:boolean;garage:number;garageTarget:boolean;car:number;carTarget:0|1|null;mode:SecurityMode;alarm:boolean;message:string;events:{id:number;text:string;at:number}[];serial:number}
export type SecurityAction={type:'tick';dt:number}|{type:'gate'|'garage';open:boolean}|{type:'car';target:0|1|null}|{type:'arm';mode:SecurityMode}|{type:'motion'}|{type:'ack'}
export const initialSecurity=():SecurityState=>({gate:0,gateTarget:false,garage:0,garageTarget:false,car:0,carTarget:null,mode:'disarmed',alarm:false,message:'',events:[],serial:0})
function event(s:SecurityState,text:string):SecurityState{const id=s.serial+1;return{...s,message:text,serial:id,events:[{id,text,at:Date.now()},...s.events].slice(0,12)}}
export function securityReducer(s:SecurityState,a:SecurityAction):SecurityState{
 if(a.type==='tick'){
  const step=Math.max(0,Math.min(a.dt,.25)),toward=(v:number,t:number,speed:number)=>Math.abs(t-v)<step*speed?t:v+Math.sign(t-v)*step*speed
  const gate=toward(s.gate,s.gateTarget?1:0,.35),garage=toward(s.garage,s.garageTarget?1:0,.30)
  let car=s.car,carTarget=s.carTarget
  if(carTarget!==null&&gate===1&&garage===1){car=toward(car,carTarget,.09);if(car===carTarget)carTarget=null}
  if(gate===s.gate&&garage===s.garage&&car===s.car&&carTarget===s.carTarget)return s
  const next={...s,gate,garage,car,carTarget}
  return s.carTarget!==null&&carTarget===null?event(next,car===1?'Автомобиль в гараже':'Автомобиль выехал'):next
 }
 if(a.type==='gate'||a.type==='garage'){
  if(s.mode!=='disarmed')return event(s,'Сначала снимите охрану')
  if(!a.open&&(s.carTarget!==null||(s.car>0&&s.car<1)))return event(s,'Проезд занят автомобилем')
  return event({...s,[a.type+'Target']:a.open},a.type==='gate'?(a.open?'Въездные ворота открываются':'Въездные ворота закрываются'):(a.open?'Гараж открывается':'Гараж закрывается'))
 }
 if(a.type==='car'){
  if(s.mode!=='disarmed')return event(s,'Сначала снимите охрану')
  if(a.target===null)return event({...s,carTarget:null},'Автомобиль остановлен')
  if(s.car===a.target)return event(s,a.target===1?'Автомобиль уже в гараже':'Автомобиль уже снаружи')
  return event({...s,carTarget:a.target,gateTarget:true,garageTarget:true},a.target===1?'Заезд: открываем ворота':'Выезд: открываем ворота')
 }
 if(a.type==='arm'){
  if(a.mode!=='disarmed'&&(s.gate>0||s.garage>0||s.gateTarget||s.garageTarget||s.carTarget!==null||(s.car>0&&s.car<1)))return event(s,'Закройте ворота и освободите проезд')
  return event({...s,mode:a.mode,alarm:false},a.mode==='disarmed'?'Охрана снята':a.mode==='home'?'Периметр под охраной':'Дом под охраной')
 }
 if(a.type==='motion')return event({...s,alarm:s.mode!=='disarmed'||s.alarm},s.mode==='disarmed'?'Демо: движение у въезда':'Демо: тревога на периметре')
 return event({...s,alarm:false},'Тревога подтверждена')
}
export const virtualCameras=[
 {id:'gate',name:'Въезд',position:[30.55,2.15,35.6],target:[34,.9,31]},
 {id:'garage',name:'Гараж',position:[15.4,3.25,22.3],target:[19.3,1.3,12]},
 {id:'entry',name:'Главный вход',position:[-3.7,3.4,23],target:[-1,1.2,16]},
 {id:'terrace',name:'Терраса',position:[8,6.3,11],target:[6,3,17]},
 {id:'garden',name:'Сад',position:[-17.8,3.6,29],target:[-13,1,20]},
 {id:'rear',name:'Задний периметр',position:[14,7,-6],target:[7,3,0]},
] as const
