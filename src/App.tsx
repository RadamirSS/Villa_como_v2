import { useState } from 'react'
import { project, totalScheduledArea } from './domain/project'
import type { FloorRecord } from './domain/types'

const digits = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
function area(value: number) { return digits.format(value) + ' м²' }
const phases = [
  { id: '00', name: 'Подготовка', text: 'Архитектура данных, источники и контроль качества', active: true },
  { id: '01', name: 'Точная геометрия', text: 'Контуры, стены, размеры, проёмы и лестницы', active: false },
  { id: '02', name: 'Предметное наполнение', text: 'Мебель, встроенные элементы и сантехника', active: false },
  { id: '03', name: '3D и визуализация', text: 'Объёмы, материалы, освещение и сценарии', active: false },
]
function floorTag(floor: FloorRecord) {
  return floor.id === 'garage' ? 'G' : floor.id.slice(-1)
}

export default function App() {
  const [floorId, setFloorId] = useState<FloorRecord['id']>('level-1')
  const [details, setDetails] = useState(false)
  const floor = project.floors.find((f) => f.id === floorId) ?? project.floors[1]
  return (
    <div className="shell">
      <aside className="rail">
        <a className="rail-logo" href="/" aria-label="Villa Como v2">V<span>.</span>C</a>
        <div className="rail-axis"><span /><span /><span /></div>
        <div className="rail-foot">MÈTRE<br/>2026</div>
      </aside>
      <div className="body">
        <header className="topbar">
          <div className="breadcrumbs"><span>PROJECTS</span><i>/</i><strong>VILLA COMO</strong><i>/</i><span>V2</span></div>
          <div className="top-actions">
            <span className="mode-dot">ПОДГОТОВИТЕЛЬНЫЙ ЭТАП</span>
            <a href="https://github.com/RadamirSS/Villa_como_v2" target="_blank" rel="noreferrer" className="text-link">GitHub ↗</a>
          </div>
        </header>
        <main className="page">
          <div className="intro">
            <div className="eyebrow"><span className="accent-bar"/> ARCHITECTURAL DIGITAL TWIN <span className="serial">/ 00 — FOUNDATION</span></div>
            <div className="intro-row">
              <div><h1>Villa <em>Como.</em></h1><p className="lede">Точность начинается с плана. Единая система данных для 2D, 3D и инженерной модели виллы.</p></div>
              <div className="phase-stamp"><span>ТЕКУЩИЙ ЭТАП</span><strong>00<span>/03</span></strong><small>Архитектурная подготовка</small></div>
            </div>
          </div>
          <div className="metrics">
            <div className="metric"><span>КОНТРОЛЬНЫЕ УРОВНИ</span><strong>04</strong><small>3 этажа + гараж</small></div>
            <div className="metric"><span>ПЛОЩАДЬ ПО ВЕДОМОСТЯМ</span><strong>{area(totalScheduledArea)}</strong><small>включая террасу второго этажа</small></div>
            <div className="metric"><span>ОЦИФРОВАНО ПЛАНОВ</span><strong>00 <span>/ 04</span></strong><small>геометрия пока отсутствует</small></div>
            <div className="metric"><span>ИСТОЧНИК</span><strong>94 <span>стр.</span></strong><small>MÈTRE · 09.02.2026</small></div>
          </div>
          <section className="workspace">
            <div className="workspace-head">
              <div><div className="micro">01 / ARCHITECTURE</div><h2>Пространственная модель</h2></div>
              <span className="workspace-state"><span className="small-circle"/> ОЖИДАЕТ ОЦИФРОВКИ</span>
            </div>
            <div className="floor-tabs" role="tablist" aria-label="Уровни виллы">
              {project.floors.map((f) => (
                <button key={f.id} className={'floor-tab ' + (f.id === floor.id ? 'selected' : '')}
                  role="tab" aria-selected={f.id === floor.id}
                  onClick={() => { setFloorId(f.id); setDetails(false) }}>
                  <span className="floor-index">{floorTag(f)}</span>{f.shortTitle}
                </button>
              ))}
            </div>
            <div className="workspace-grid">
              <div className="draft-surface" aria-label="Здесь появится подтверждённый 2D-план после этапа 1">
                <div className="axis-x">X / MM</div><div className="axis-z">Z / MM</div>
                <span className="crosshair crosshair-a">+</span><span className="crosshair crosshair-b">+</span>
                <div className="empty-plan">
                  <div className="empty-icon"><span className="line one"/><span className="line two"/><span className="line three"/><span className="line four"/></div>
                  <span className="empty-kicker">ГЕОМЕТРИЯ / НЕ СОЗДАНА</span>
                  <h3>{floor.title}</h3>
                  <p>После проверки размерных цепочек здесь появится точный 2D-план. Случайный контур не используется.</p>
                  <span className="empty-marker">СЛЕДУЮЩИЙ ЭТАП: 01 — ТОЧНАЯ ПЛАНИРОВКА</span>
                </div>
                <div className="surface-scale">UNITS <span>MM</span> · NO ASSUMED DIMENSIONS</div>
              </div>
              <aside className="floor-detail">
                <div className="micro">02 / SOURCE PASSPORT</div>
                <h3>{floor.title}</h3>
                <div className="detail-line"><span>Ведомость</span><strong>{floor.scheduleSheet}</strong></div>
                <div className="detail-line"><span>Площадь по проекту</span><strong>{area(floor.scheduleAreaM2)}</strong></div>
                <div className="detail-line"><span>Позиций ведомости</span><strong>{floor.scheduleRooms}</strong></div>
                {floor.terraceAreaM2 !== null && <div className="detail-line"><span>В том числе терраса</span><strong>{area(floor.terraceAreaM2)}</strong></div>}
                <div className="detail-line"><span>Статус геометрии</span><strong>Не перенесена</strong></div>
                <div className="detail-description">{floor.description}</div>
                <button className="sources-toggle" type="button" onClick={() => setDetails(!details)} aria-expanded={details}>
                  Источники и привязка <span>{details ? '−' : '+'}</span>
                </button>
                {details && <div className="sources-list">
                  <div className="source-label">ОСНОВНЫЕ ЛИСТЫ</div>
                  <div className="source-chips">{floor.sourceSheets.map((s) => <span key={s}>{s}</span>)}</div>
                  <p>{floor.elevationBasis}</p>
                </div>}
                <div className="detail-note"><span>i</span> Числа взяты из ведомостей проекта, а не рассчитаны по несуществующей модели.</div>
              </aside>
            </div>
          </section>
          <section className="roadmap">
            <div className="roadmap-heading"><div><div className="micro">03 / DELIVERY ROADMAP</div><h2>Порядок построения</h2></div><span>01 / 04 · ЭТАП 0 ГОТОВ</span></div>
            <div className="steps">
              {phases.map((step) => <div key={step.id} className={'step ' + (step.active ? 'step-active' : '')}>
                <div className="step-index">{step.id}{step.active && <span className="active-spark"/>}</div>
                <div><h3>{step.name}</h3><p>{step.text}</p></div>
              </div>)}
            </div>
          </section>
          <footer><span>VILLA COMO / MODEL WORKSPACE</span><span>STAGE 0 — NO GEOMETRY CLAIMED</span><span>© 2026</span></footer>
        </main>
      </div>
    </div>
  )
}
