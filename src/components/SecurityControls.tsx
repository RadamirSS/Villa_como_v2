import {tx} from '../i18n'
import {cameraStations,type CameraId,type SecurityController} from '../domain/security'

export default function SecurityControls({security,onShowSite,onChooseCamera}:{security:SecurityController;onShowSite:()=>void;onChooseCamera:(id:CameraId)=>void}){
 const s=security.state
 return <div className="security-sheet">
  <p className="panel-intro">{tx('Интерактивная демонстрация автоматики, видеонаблюдения и охраны. Физические устройства не подключены.')}</p>
  <div className={'security-status'+(s.triggered?' security-alert':'')}>
   <span className="security-status-dot"/><div><b>{tx(s.triggered?'Демо-тревога':s.armed?'Периметр под охраной':'Охрана выключена')}</b><small role="status">{tx(s.event)}</small></div>
  </div>
  <h3>{tx('Въезд и гараж')}</h3>
  <div className="security-actions">
   <button className="security-action" onClick={()=>security.setGate(!s.gateOpen)} aria-pressed={s.gateOpen}>
    <span aria-hidden="true">▤</span><b>{tx('Въездные ворота')}</b><small>{tx(s.gateOpen?'Открыты':'Закрыты')}</small>
   </button>
   <button className="security-action" onClick={()=>security.setGarage(!s.garageOpen)} aria-pressed={s.garageOpen}>
    <span aria-hidden="true">▥</span><b>{tx('Ворота гаража')}</b><small>{tx(s.garageOpen?'Открыты':'Закрыты')}</small>
   </button>
  </div>
  <div className="security-scenario-actions">
   <button className="panel-secondary" onClick={()=>{security.driveIn();onShowSite()}}>{tx('▶ Приехать домой')}</button>
   <button className="panel-secondary" onClick={()=>{security.driveOut();onShowSite()}}>{tx('↗ Выехать со двора')}</button>
  </div>
  <p className="security-note">{tx('Демонстрационный автомобиль движется по маршруту после открытия обоих ворот.')}</p>
  <h3>{tx('Виртуальные камеры')}</h3>
  <div className="security-camera-grid">
   {cameraStations.map((cam,i)=><button type="button" key={cam.id} className={'security-camera-option'+(s.cameraId===cam.id?' selected':'')} onClick={()=>onChooseCamera(cam.id)} aria-pressed={s.cameraId===cam.id}>
    <span>CAM {String(i+1).padStart(2,'0')}</span><b>{tx(cam.name)}</b><small>{tx('Открыть ракурс')}</small>
   </button>)}
  </div>
  <label className="security-night"><span>{tx('Ночная визуализация камеры')}</span><input type="checkbox" checked={s.nightVision} onChange={e=>security.setNightVision(e.target.checked)}/></label>
  <p className="security-note">{tx('Камеры показывают виртуальный ракурс этой же 3D-модели, а не видеопоток с реального объекта.')}</p>
  <h3>{tx('Охрана периметра')}</h3>
  <div className="security-scenario-actions">
   <button className="panel-secondary" onClick={()=>{s.armed?security.disarm():security.arm();onShowSite()}}>{tx(s.armed?'Снять с охраны':'Поставить на охрану')}</button>
   <button className="panel-secondary" onClick={()=>{security.simulateMotion();onChooseCamera('gate')}}>{tx('Имитировать движение')}</button>
  </div>
  {s.triggered&&<button className="security-reset" onClick={security.clearAlarm}>{tx('Сбросить тревогу')}</button>}
  <p className="security-note">{tx('Сигнализация и обнаружение движения — только симуляция. Реальных уведомлений или команд нет.')}</p>
 </div>
}
