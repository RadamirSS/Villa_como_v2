import {tx} from '../i18n'
import type {LightingController} from '../domain/useLighting'
import ShowroomIcon from './ShowroomIcon'
export default function CourtyardLight({lighting,onShow}:{lighting:LightingController;onShow:()=>void}) {
 return <section className="courtyard-control" aria-label={tx('Свет во дворе')}>
  <ShowroomIcon name="light"/><div><b>{tx('Свет во дворе')}</b><small>{tx(lighting.courtyard?'Свет включён':'Свет выключен')} · {tx('Демо')}</small></div>
  <button className="power-switch" role="switch" aria-label={tx('Свет во дворе')} aria-checked={lighting.courtyard} onClick={()=>lighting.setCourtyard(!lighting.courtyard)}><span/></button>
  <p>{tx('Дорожки, въезд и парковка. Добавлено для демонстрации, в исходном проекте отсутствует.')}</p>
 <button className="panel-secondary courtyard-show" onClick={onShow}>{tx("Показать двор")}</button></section>
}
