import {useState}from'react'
import{kindLabels,lightingPlan,lightScenarios,roomGroups,roomIsOn,type LightingFloor,type LightKind}from'../domain/lighting'
import type{LightingController}from'../domain/useLighting'
export default function LightingControls({floor,room,onRoom,lighting}:{floor:LightingFloor;room:number|null;onRoom:(n:number)=>void;lighting:LightingController}){
 const[open,setOpen]=useState(false)
 const rooms=lightingPlan.rooms.filter(r=>r.floor===floor),selected=rooms.find(r=>r.number===room)??rooms[0]
 const groups=roomGroups(floor,selected.number),on=roomIsOn(lighting.state,floor,selected.number),count=Object.values(lighting.state).filter(Boolean).length
 const scenario=lightScenarios.find(s=>s.id===lighting.scenario)
 const controls=lightingPlan.controls.filter(c=>c.floor===floor&&c.groups.some(id=>groups.some(g=>g.id===id)))
 return <section className="lighting-controls" aria-label="Управление освещением">
  <div className="lighting-scenes">
   <span className="lighting-mode-label">СВЕТ · ДЕМО</span>
   <select aria-label="Сценарий освещения" value={lighting.scenario??''} onChange={e=>lighting.applyScenario(e.target.value)}>
    <option value="" disabled>Выбрать сценарий…</option>{lightScenarios.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
   </select>
   <div className="lighting-time" role="group" aria-label="Время суток">{(['day','dusk','night']as const).map((time,i)=><button key={time} aria-pressed={lighting.time===time} onClick={()=>lighting.setTime(time)}>{['День','Сумерки','Ночь'][i]}</button>)}</div>
   <button onClick={()=>lighting.setAll(false)}>Всё выключить</button>
   <button aria-pressed={lighting.wiring} onClick={()=>lighting.setWiring(!lighting.wiring)}>Связи групп</button>
   <span className="lighting-counter" role="status">{count} / {lightingPlan.groups.length} групп включено</span>
  </div>
  <div className="lighting-room-row">
   <select aria-label="Комната для управления светом" value={selected.number} onChange={e=>onRoom(Number(e.target.value))}>{rooms.map(r=><option key={r.id} value={r.number}>{roomIsOn(lighting.state,floor,r.number)?'● ':'○ '}{r.number} · {r.name}</option>)}</select>
   <button className={'room-light-toggle '+(on?'is-on':'')} role="switch" aria-checked={on} aria-label={`Свет: ${selected.name}`} onClick={()=>lighting.setRoom(floor,selected.number,!on)}>{on?'☀ Выключить комнату':'◯ Включить комнату'}</button>
   <button aria-expanded={open} onClick={()=>setOpen(!open)}>Группы и выключатели {open?'−':'+'}</button>
  </div>
  {scenario&&<p className="lighting-scene-caption"><b>{scenario.name}</b> · {scenario.description}</p>}
  {open&&<div className="lighting-detail">
   <div className="lighting-group-list">{groups.map(g=><div className={'lighting-group '+(lighting.state[g.id]?'lit':'')} key={g.id}>
    <div><b>{g.evidence==='drawing-unmarked-circuit'||g.evidence==='drawing-symbol-only'?'Без марки':g.mark} · {kindLabels[g.kind as LightKind]}</b><small>{g.name}</small><span>{g.sheet}{g.evidence==='demo-unresolved'?' · Демо: группа в проекте не задана':g.evidence==='drawing-unmarked-circuit'?' · Цепь без марки':g.evidence==='drawing-label-only'?' · Только марка на плане':g.evidence==='drawing-symbol-only'?' · Прибор с собственным выключателем':''}</span></div>
    <button role="switch" aria-checked={!!lighting.state[g.id]} aria-label={`Группа ${g.mark}: ${g.name}`} onClick={()=>lighting.toggleGroup(g.id)}>{lighting.state[g.id]?'Вкл':'Выкл'}</button>
   </div>)}</div>
   {controls.length>0&&<div className="lighting-switch-list"><b>Связанные выключатели · по подписям проекта</b>{controls.map((control,i)=><button key={control.id} onClick={()=>lighting.toggleControl(control.groups,control.evidence==='drawing-gate-contact')} aria-label={`Выключатель ${i+1}: ${control.label}`}><span>{control.label}</span><small>{control.groups.every(id=>lighting.state[id])?'● Включено':'○ Переключить'} · {control.sourceSheet}</small></button>)}</div>}
   <p>Состояние общее для всех выключателей группы. Команды демонстрационные; оборудование не подключено. {lighting.wiring?'Линии показывают связи группы, а не кабельные трассы.':''}</p>
  </div>}
  {lighting.wiring&&<div className="lighting-wiring-caption">Условные связи светильников внутри групп · не монтажная схема проводки</div>}
 </section>
}
