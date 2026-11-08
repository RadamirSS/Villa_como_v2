import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { project, totalScheduledArea } from './domain/project'
import rawPlans from './data/architectural-plans.json'
import compressedTraces from './data/source-traces.json'
import type { ArchitecturalPlan, ArchitecturalPlanSet, PlanRoom } from './data/plan-types'
import type { FloorRecord } from './domain/types'

const plans = rawPlans as unknown as ArchitecturalPlanSet
const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const signed = (n: number) => (n > 0 ? '+' : '') + new Intl.NumberFormat('ru-RU').format(n)
const area = (n: number) => format.format(n) + ' м²'
const floorIds = ['level-1', 'level-2', 'level-3', 'garage'] as const
const swingLabel = { left: 'Левое', right: 'Правое', double: 'Двустворчатое' } as const
const partitionColor = { block: '#e3b95c', gypsum: '#dd9872', infill: '#7db5c1' }
type PanelTab = 'rooms' | 'doors' | 'dimensions'

type ToggleLayers = { finish: boolean; construction: boolean; rooms: boolean }

function PlanViewer({ floor, data, selectedRoom, onSelectRoom }: {
  floor: FloorRecord
  data: ArchitecturalPlan
  selectedRoom: number | null
  onSelectRoom: (value: number) => void
}) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [layers, setLayers] = useState<ToggleLayers>({ finish: true, construction: true, rooms: true })
  const stage = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setSvg('')
    setError(null)
    const decode = async () => {
      const base64 = compressedTraces[floor.id]
      const binary = atob(base64)
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
      return new Response(stream).text()
    }
    decode()
      .then(value => { if (alive) { setSvg(value); setLoading(false) } })
      .catch(err => { if (alive) { setError(String(err)); setLoading(false) } })
    setZoom(1); setPan({ x: 0, y: 0 })
    return () => { alive = false }
  }, [floor.id])

  useEffect(() => {
    const element = stage.current
    if (!element) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(value => Math.min(5, Math.max(.65, +(value * (e.deltaY < 0 ? 1.11 : .9)).toFixed(3))))
    }
    element.addEventListener('wheel', handler, { passive: false })
    return () => element.removeEventListener('wheel', handler)
  }, [])

  const toggle = (key: keyof ToggleLayers) => setLayers(value => ({ ...value, [key]: !value[key] }))
  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-room-marker="true"]')) return
    if (event.button !== 0 && event.pointerType === 'mouse') return
    pointer.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: pan.x, startY: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = pointer.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setPan({ x: drag.startX + event.clientX - drag.x, y: drag.startY + event.clientY - drag.y })
  }
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointer.current || pointer.current.pointerId !== event.pointerId) return
    pointer.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const changeZoom = (value: number) => setZoom(z => Math.max(.65, Math.min(5, +(z * value).toFixed(3))))
  const fit = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const downloadSvg = () => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `villa-como-${floor.id}-source-lines.svg`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="plan-wrap">
    <div className="plan-top-strip">
      <div className="plan-title">
        <span className="live-indicator" />
        <span>АРХИТЕКТУРНЫЙ 2D · ЛИНИИ ИЗ PDF</span>
      </div>
      <div className="plan-controls">
        <button aria-label="Уменьшить" title="Уменьшить" onClick={() => changeZoom(1 / 1.2)}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button aria-label="Увеличить" title="Увеличить" onClick={() => changeZoom(1.2)}>+</button>
        <button className="fit-control" onClick={fit}>Вписать</button>
      </div>
    </div>
    <div className="layer-bar" aria-label="Слои проекта">
      <span>СЛОИ</span>
      <button className={layers.finish ? 'layer-active' : ''} onClick={() => toggle('finish')} aria-pressed={layers.finish}>
        <i className="layer-marker finish-marker" /> Чистовые грани
      </button>
      <button className={layers.construction ? 'layer-active' : ''} onClick={() => toggle('construction')} aria-pressed={layers.construction}>
        <i className="layer-marker construction-marker" /> Новые перегородки
      </button>
      <button className={layers.rooms ? 'layer-active' : ''} onClick={() => toggle('rooms')} aria-pressed={layers.rooms}>
        <i className="layer-marker room-marker" /> Номера помещений
      </button>
    </div>
    <div className="plan-stage" ref={stage} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="plan-stage-origin">
        <div className="plan-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <div className={'vector-document ' + (!layers.finish ? 'finish-hidden' : '')} style={{ aspectRatio: data.viewport.width + '/' + data.viewport.height }}>
            {loading && <div className="plan-loading">Загрузка исходных векторов…</div>}
            {error && <div className="plan-error">Не удалось загрузить векторный чертёж: {error}</div>}
            {!!svg && <div className="vector-ink" dangerouslySetInnerHTML={{ __html: svg }} />}
            <svg className="plan-overlay" viewBox={`0 0 ${data.viewport.width} ${data.viewport.height}`} role="img" aria-label="Проектные перегородки и номера помещений">
              {layers.construction && data.newPartitionShapes.map((region, i) => <rect key={i} x={region.x} y={region.y} width={region.width} height={region.height}
                fill={partitionColor[region.kind]} stroke="none" opacity="0.87" />)}
              {layers.rooms && data.rooms.filter((room): room is PlanRoom & { marker: [number, number] } => room.marker !== null).map(room => <g
                key={room.number} transform={`translate(${room.marker[0]},${room.marker[1]})`} data-room-marker="true"
                className={'room-pin ' + (room.number === selectedRoom ? 'room-pin-active' : '')}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onSelectRoom(room.number) }}
                role="button" tabIndex={0} aria-label={`Помещение № ${room.number}: ${room.name}`}>
                <circle r={room.number === selectedRoom ? 12 : 9.5} />
                <text textAnchor="middle" dominantBaseline="central">{room.number}</text>
                <title>{room.name} · {area(room.areaM2)} · {data.furnitureSheet}</title>
              </g>)}
            </svg>
          </div>
        </div>
      </div>
      <div className="corner-axis corner-axis-tl">X / ARCH</div>
      <div className="corner-axis corner-axis-br">SOURCE: {data.finalSheet} · МАСШТАБ ЭКРАНА НЕ ФИКСИРОВАН</div>
    </div>
    <div className="plan-footbar">
      <span>Векторный контур из {data.finalSheet} · монтаж {data.installSheet} · маркировка {data.furnitureSheet}</span>
      <button type="button" onClick={downloadSvg} disabled={!svg}>Скачать SVG ↗</button>
    </div>
  </div>
}

function InfoPanel({ floor, data, selectedRoom, onSelectRoom }: {
  floor: FloorRecord
  data: ArchitecturalPlan
  selectedRoom: number | null
  onSelectRoom: (value: number) => void
}) {
  const [tab, setTab] = useState<PanelTab>('rooms')
  const [query, setQuery] = useState('')
  useEffect(() => { setTab('rooms'); setQuery('') }, [floor.id])
  const filtered = data.rooms.filter(r => (r.name + ' ' + r.number).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const chosen = data.rooms.find(room => room.number === selectedRoom)
  return <aside className="info-panel">
    <div className="info-head">
      <span className="section-index">02 / ПАСПОРТ УРОВНЯ</span>
      <h3>{floor.title}</h3>
      <div className="info-grid">
        <div><span>Площадь по ведомости</span><b>{area(floor.scheduleAreaM2)}</b></div>
        <div><span>Проектных помещений</span><b>{data.rooms.length}</b></div>
      </div>
      {chosen && <div className="selected-info"><span>ВЫБРАНО ПОМЕЩЕНИЕ № {chosen.number}</span><b>{chosen.name}</b><small>{area(chosen.areaM2)} · {data.furnitureSheet}</small><button onClick={() => onSelectRoom(chosen.number)}>×</button></div>}
    </div>
    <div className="info-tabs" role="tablist" aria-label="Данные этажа">
      <button className={tab === 'rooms' ? 'selected' : ''} role="tab" aria-selected={tab === 'rooms'} onClick={() => setTab('rooms')}>Помещения</button>
      <button className={tab === 'doors' ? 'selected' : ''} role="tab" aria-selected={tab === 'doors'} onClick={() => setTab('doors')}>Двери</button>
      <button className={tab === 'dimensions' ? 'selected' : ''} role="tab" aria-selected={tab === 'dimensions'} onClick={() => setTab('dimensions')}>Размеры</button>
    </div>
    <div className="info-scroll">
      {tab === 'rooms' && <>
        <input aria-label="Поиск помещений" className="room-search" placeholder="Поиск по помещению…" value={query} onChange={e => setQuery(e.target.value)} />
        <div className="room-table">
          {filtered.map(r => <button key={r.number} className={'room-row ' + (selectedRoom === r.number ? 'row-active' : '')} onClick={() => onSelectRoom(r.number)}>
            <span className="room-num">{String(r.number).padStart(2, '0')}</span><span className="room-name">{r.name}</span><strong>{format.format(r.areaM2)}</strong>
          </button>)}
          {filtered.length === 0 && <p className="empty-search">Совпадений нет</p>}
        </div>
        <p className="source-note">Значения из {data.furnitureSheet}. Круги на плане привязаны к напечатанным номерам, а не рассчитаны как центроиды BIM-полигонов.</p>
      </>}
      {tab === 'doors' && <>
        <p className="source-note">Спецификация чистовых проёмов {data.finalSheet}. Размеры в мм, обозначения и направления открывания сохранены по рабочему листу.</p>
        <div className="door-head"><span>МАРКА / ОТКРЫВАНИЕ</span><span>ПРОЁМ Ш×В</span><span>ПОЛОТНО Ш×В</span></div>
        {data.doorSpecification.map(door => <div className="door-row" key={door.mark}>
          <span><b>{door.mark}</b><small>{swingLabel[door.swing]}{door.count > 1 ? ' · ×' + door.count : ''}</small></span>
          <span>{door.openingWidthMm} × {door.openingHeightMm}</span>
          <span>{door.leafWidthMm} × {door.leafHeightMm}</span>
        </div>)}
        <p className="source-note">Привязка каждой марки к ID стены остаётся следующей задачей. Для гаража три фасадных проёма указаны отдельно в контрольных размерах {data.measuredSheet}.</p>
      </>}
      {tab === 'dimensions' && <>
        <p className="source-note">Выписанные размерные значения из рабочих листов. Они не вычисляются из экранного масштаба и не подменяются измерениями на изображении.</p>
        {data.controlDimensions.map((dimension, index) => <div className="dimension-row" key={index}>
          <div><span>{dimension.label}</span><small>{dimension.sheet}</small></div>
          <strong>{dimension.mm !== undefined ? signed(dimension.mm) + ' мм' : dimension.m2 !== undefined ? area(dimension.m2) : '—'}</strong>
        </div>)}
        <div className="dimension-warning">Для метрически точной CAD/BIM-модели необходимо связать каждый узел стены с размерной цепочкой, а каждый дверной проём — с конкретным сегментом стены. Пока этот контроль не завершён.</div>
      </>}
    </div>
    <div className="info-bottom"><span>ПРОЕКТНЫЙ ИСТОЧНИК</span><strong>MÈTRE / {data.finalSheet}</strong></div>
  </aside>
}

export default function App() {
  const [floorId, setFloorId] = useState<typeof floorIds[number]>('level-1')
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null)
  const [infoExpanded, setInfoExpanded] = useState(false)
  const floor = useMemo(() => project.floors.find(item => item.id === floorId)!, [floorId])
  const data = plans.floors[floorId]
  const doorsTotal = Object.values(plans.floors).reduce((sum, item) => sum + item.doorSpecification.reduce((v, door) => v + door.count, 0), 0)
  const chooseFloor = (id: typeof floorIds[number]) => { setFloorId(id); setSelectedRoom(null) }
  const selectRoom = (number: number) => setSelectedRoom(previous => previous === number ? null : number)
  return <div className="app-shell">
    <nav className="side-rail" aria-label="Навигация"><a href="/" aria-label="Villa Como v2" className="brand-mark">V<span>.</span>C</a><div className="rail-rule"><i /><i /><i /></div><span className="rail-caption">MÈTRE<br/>2026</span></nav>
    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumbs"><span>VILLA COMO</span><i>/</i><b>2D ARCHITECTURE</b><i>/</i><span>ЭТАП 01</span></div>
        <div className="header-actions"><span className="status-light" /> <span>ПРОЕКТНЫЕ ЛИНИИ ПЕРЕНЕСЕНЫ</span> <a href="https://github.com/RadamirSS/Villa_como_v2" target="_blank" rel="noreferrer">GitHub ↗</a></div>
      </header>
      <div className="page-content">
        <div className="intro">
          <div className="eyebrow"><span className="eyebrow-line" /> CAD-SOURCED ARCHITECTURAL PLANS <span className="muted">/ 01</span></div>
          <h1>Villa <em>Como.</em></h1>
          <div className="intro-bottom"><p>Архитектура без догадок: исходные векторные линии, помещение за помещением, с привязкой к рабочим листам MÈTRE.</p><span className="intro-step"><span>ЭТАП ПРОЕКТА</span><b>01<small>/03</small></b><small>Двумерная архитектура</small></span></div>
        </div>
        <section className="metrics" aria-label="Показатели проекта">
          <div><span>УРОВНИ</span><strong>04</strong><small>3 этажа и гараж</small></div>
          <div><span>ПЛОЩАДЬ ПО ВЕДОМОСТЯМ</span><strong>{area(totalScheduledArea)}</strong><small>без подмены геометрическими расчётами</small></div>
          <div><span>ПОЗИЦИИ ПОМЕЩЕНИЙ</span><strong>44</strong><small>7 + 19 + 13 + 5</small></div>
          <div><span>МАРКИ ДВЕРЕЙ / ПРОЁМОВ</span><strong>{doorsTotal}</strong><small>по A-14–A-17</small></div>
        </section>
        <section className="architecture-section">
          <div className="section-head"><div><span className="section-index">01 / ARCHITECTURAL WORKSPACE</span><h2>Планы помещений</h2></div><span className="verified-state"><i /> ВЕКТОРЫ ИЗ ИСХОДНОГО PDF</span></div>
          <div className="floor-navigation" role="tablist" aria-label="Выбор этажа">
            {floorIds.map((id, i) => <button role="tab" aria-selected={floorId === id} key={id} className={'floor-choice ' + (id === floorId ? 'active' : '')} onClick={() => chooseFloor(id)}>
              <b>{id === 'garage' ? 'G' : String(i + 1).padStart(2, '0')}</b><span>{id === 'garage' ? 'Гараж' : (i + 1) + ' этаж'}</span><small>{area(project.floors.find(f => f.id === id)!.scheduleAreaM2)}</small>
            </button>)}
          </div>
          <div className="workspace-grid">
            <PlanViewer floor={floor} data={data} selectedRoom={selectedRoom} onSelectRoom={selectRoom} />
            <InfoPanel floor={floor} data={data} selectedRoom={selectedRoom} onSelectRoom={selectRoom} />
          </div>
        </section>
        <section className="provenance-section">
          <div><span className="section-index">02 / PROVENANCE</span><h2>Проверяемые источники</h2></div>
          <div className="sources-grid">
            <div><span>ОБМЕРНЫЙ ПЛАН</span><b>{data.measuredSheet}</b><p>Первоначальные размеры и отметки</p></div>
            <div><span>ПЛАН МОНТАЖА</span><b>{data.installSheet}</b><p>Возводимые перегородки и зашивки</p></div>
            <div><span>ЧИСТОВЫЕ ПРОЁМЫ</span><b>{data.finalSheet}</b><p>Контуры стен, двери, чистовые грани</p></div>
            <div><span>МЕБЕЛЬНЫЙ ПЛАН</span><b>{data.furnitureSheet}</b><p>Номера и площади помещений</p></div>
          </div>
        </section>
        <div className="audit-note"><div><span>!</span><strong>Граница достоверности</strong></div><p>Отображаемые стены и линии являются прямым извлечением векторной графики проектного PDF (A‑14–A‑17), а не повторной ручной обводкой. Номера помещений привязаны к напечатанным меткам на A‑18–A‑21. <b>Метрическая BIM-модель пока не готова:</b> отсутствует семантическая разбивка всех стен на измеренные сегменты, не закрыты все размерные цепочки и не привязаны дверные марки к ID стен. Поэтому план нельзя использовать для изготовления дверей или строительства без контрольного обмера.</p></div>
        <div className="bottom-actions"><a href="https://github.com/RadamirSS/Villa_como_v2/tree/main/docs" target="_blank" rel="noreferrer">Методика и незакрытые вопросы ↗</a><button onClick={() => setInfoExpanded(!infoExpanded)}>{infoExpanded ? 'Скрыть требования к 3D' : 'Что нужно для точного 3D?'} <span>{infoExpanded ? '−' : '+'}</span></button></div>
        {infoExpanded && <div className="expanded-note">Следующий инженерный шаг: привязать все текущие векторные контуры к координатам в целых миллиметрах, формализовать стенные сегменты, их толщины и проёмы, проверить замкнутые размерные цепочки по A‑03–A‑17 и согласовать межэтажные отметки. Только после этого один набор данных будет надёжно генерировать 2D и 3D.</div>}
        <footer><span>VILLA COMO / DIGITAL DESIGN</span><span>MÈTRE · Рабочая документация</span><span>© 2026</span></footer>
      </div>
    </main>
  </div>
}
