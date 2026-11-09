import {tx} from '../i18n'
import type {SecurityController} from '../domain/useSecurity'
export default function QuickAccess({id,security,onClose}:{id:string;security:SecurityController;onClose:()=>void}){
 const s=security.state,door=id==='gate'||id==='garage',target=id==='gate'?s.gateTarget:s.garageTarget
 const remaining=s.garageCloseAt===null?null:Math.max(0,Math.ceil((s.garageCloseAt-s.clock)/1000))
 return <section className="quick-access glass-control" aria-label={tx('Управление на модели')}>
 <header><b>{tx(id==='gate'?'Въездные ворота':id==='garage'?'Ворота гаража':'Автомобиль')}</b><button aria-label={tx('Закрыть')} onClick={onClose}>×</button></header>
 {door?<><p role="status">{tx((id==='gate'?s.gate:s.garage)===(target?1:0)?(target?'Открыто':'Закрыто'):(target?'Открывается':'Закрывается'))}</p><div className="system-actions"><button className="panel-secondary" onClick={()=>security.dispatch({type:id as 'gate'|'garage',open:true})}>{tx('Открыть')}</button><button className="panel-secondary" onClick={()=>security.dispatch({type:id as 'gate'|'garage',open:false})}>{tx('Закрыть')}</button></div>{id==='garage'&&remaining!==null&&<small>{tx('Автозакрытие гаража через')} {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</small>}</>:<><div className="system-actions"><button className="panel-secondary" disabled={s.car===1} onClick={()=>{security.dispatch({type:'car',target:1});if(s.mode==='disarmed')onClose()}}>{tx('Заехать в гараж')}</button><button className="panel-secondary" disabled={s.car===0} onClick={()=>{security.dispatch({type:'car',target:0});if(s.mode==='disarmed')onClose()}}>{tx('Выехать')}</button>{s.carTarget!==null&&<button className="panel-secondary" onClick={()=>security.dispatch({type:'car',target:null})}>{tx('Остановить')}</button>}</div></>}
 {s.message&&<small role="status">{tx(s.message)}</small>}
 </section>
}
