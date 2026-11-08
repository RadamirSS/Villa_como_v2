import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { project, totalScheduledArea } from './domain/project'
import rawPlans from './data/architectural-plans.json'
import compressedTraces from './data/source-traces.json'
import furnitureVectors from './data/furniture-vectors.json'
import plumbingVectors from './data/plumbing-vectors.json'
import plumbingRegister from './data/plumbing-register.json'
import SourceVector from './components/SourceVector'
import Villa3D from './components/Villa3D'
import type { ArchitecturalPlan, ArchitecturalPlanSet, PlanRoom } from './data/plan-types'
import type { FloorRecord } from './domain/types'

const plans = rawPlans as unknown as ArchitecturalPlanSet
const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
const signed = (n: number) => (n > 0 ? '+' : '') + new Intl.NumberFormat('ru-RU').format(n)
const area = (n: number) => format.format(n) + ' м²'
const floorIds = ['level-1', 'level-2', 'level-3', 'garage'] as const
const swingLabel = { left: 'Левое', right: 'Правое', double: 'Двустворчатое' } as const
const partitionColor = { block: '#e3b95c', gypsum: '#dd9872', infill: '#7db5c1' }
type PanelTab = 'rooms' | 'plumbing' | 'doors' | 'dimensions'
type PlumbingFixture = { mark: string; name: string | null; quantity: number | null; sheet: string; status: string }
type PlumbingGroup = { sheet: string; page: number; floor: string; rooms: number[]; title: string; viewport: {width: number; height: number}; fixtures: PlumbingFixture[]; confidence: string; note: string }
const plumbing = plumbingRegister as unknown as Record<string, PlumbingGroup>
const plumbingByFloor = (id: string) => Object.values(plumbing).filter(p => p.floor === id)

type ToggleLayers = { finish: boolean; construction: boolean; rooms: boolean; furniture: boolean; plumbing: boolean }

function PlanViewer({ floor, data, selectedRoom, onSelectRoom, onOpenPlumbing }: {
  floor: FloorRecord
  data: ArchitecturalPlan
  selectedRoom: number | null
  onSelectRoom: (value: number) => void
  onOpenPlumbing: (sheet: string) => void
}) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [layers, setLayers] = useState<ToggleLayers>({ finish: true, construction: false, rooms: true, furniture: true, plumbing: true })
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
        <span>{layers.furniture ? 'МЕБЕЛИРОВАНИЕ · ИСХОДНЫЕ ВЕКТОРЫ ' + data.furnitureSheet : 'АРХИТЕКТУРНЫЙ 2D · ' + data.finalSheet}</span>
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
      <button className={layers.furniture ? 'layer-active' : ''} onClick={() => toggle('furniture')} aria-pressed={layers.furniture}>
        <i className="layer-marker furniture-marker" /> Мебель · {data.furnitureSheet}
      </button>
      <button className={layers.plumbing ? 'layer-active' : ''} onClick={() => toggle('plumbing')} aria-pressed={layers.plumbing}>
        <i className="layer-marker plumbing-marker" /> Сантехнические зоны
      </button>
      <button disabled={layers.furniture} title={layers.furniture ? 'Переключитесь на архитектуру' : undefined} className={layers.finish ? 'layer-active' : ''} onClick={() => toggle('finish')} aria-pressed={layers.finish}>
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
            {layers.furniture ? <SourceVector key={floor.id} encoded={furnitureVectors[floor.id]} alt={`Векторный мебельный план ${data.furnitureSheet}`} className="furniture-source-art" /> : !!svg && <div className="vector-ink" dangerouslySetInnerHTML={{ __html: svg }} />}
            <svg className="plan-overlay" viewBox={`0 0 ${data.viewport.width} ${data.viewport.height}`} role="img" aria-label="Проектные перегородки и номера помещений">
              {layers.plumbing && plumbingByFloor(floor.id).flatMap(group => group.rooms.map(roomNum => {
                const rm = data.rooms.find(item => item.number === roomNum)
                if (!rm?.marker) return null
                return <g key={group.sheet + '-' + roomNum} data-room-marker="true" transform={`translate(${rm.marker[0] + 16},${rm.marker[1] - 14})`} className="plumbing-pin" role="button" tabIndex={0}
                  onClick={event => { event.stopPropagation(); onOpenPlumbing(group.sheet) }} onPointerDown={event => event.stopPropagation()}
                  aria-label={`Сантехника ${group.sheet} · ${rm.name}`}><circle r="7.5"/><text textAnchor="middle" dominantBaseline="central">✚</text><title>Сантехнический лист {group.sheet} для помещения № {roomNum}: {rm.name}. Точка служит навигацией, не монтажной привязкой.</title></g>
              }))}
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
      <div className="corner-axis corner-axis-br">SOURCE: {layers.furniture ? data.furnitureSheet : data.finalSheet} · ЭКРАННЫЙ МАСШТАБ УСЛОВНЫЙ</div>
    </div>
    <div className="plan-footbar">
      <span>{layers.furniture ? `Мебель по ${data.furnitureSheet}: исходное расположение, не отдельные BIM-объекты` : `Чистовые контуры ${data.finalSheet} · монтаж ${data.installSheet}`}</span>
      <button type="button" onClick={downloadSvg} disabled={!svg}>Архитектурный SVG ↗</button>
    </div>
  </div>
}

function InfoPanel({ floor, data, selectedRoom, onSelectRoom, onOpenPlumbing }: {
  floor: FloorRecord
  data: ArchitecturalPlan
  selectedRoom: number | null
  onSelectRoom: (value: number) => void
  onOpenPlumbing: (sheet: string) => void
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
      <button className={tab === 'plumbing' ? 'selected' : ''} role="tab" aria-selected={tab === 'plumbing'} onClick={() => setTab('plumbing')}>Сантехника</button>
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
      {tab === 'plumbing' && <>
        <p className="source-note">Точные марки приборов, количества и исходные планы выводов по A-22–A-29. Для просмотра нажмите на рабочий лист. Координаты выводов не выдуманы.</p>
        {plumbingByFloor(floor.id).filter(group => selectedRoom === null || group.rooms.includes(selectedRoom)).map(group => <div className="plumbing-group" key={group.sheet}>
          <div className="plumbing-group-head"><div><span>{group.sheet} · {group.fixtures.length} марок</span><b>{group.title}</b></div><button onClick={() => onOpenPlumbing(group.sheet)}>Смотреть план ↗</button></div>
          {group.fixtures.map(item => <div key={item.mark} className="fixture-row"><span className="fixture-mark">{item.mark}</span><span>{item.name ?? 'Позиция обозначена на плане; описание не извлечено из ведомости'}{item.status !== 'specified' && <small>Требует проверки PDF</small>}</span><b>{item.quantity !== null ? '×' + item.quantity : '?'}</b></div>)}
        </div>)}
        {selectedRoom !== null && !plumbingByFloor(floor.id).some(group => group.rooms.includes(selectedRoom)) && <p className="source-note">Для выбранного помещения отдельный сантехнический лист в A-22–A-29 не указан. Снимите выделение, чтобы увидеть все схемы этажа.</p>}
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

function PlumbingDetail({ sheet, onClose }: { sheet: string; onClose: () => void }) {
  const group = plumbing[sheet]
  if (!group) return null
  return <div className="plumbing-backdrop" role="presentation" onClick={onClose}><section className="plumbing-modal" role="dialog" aria-modal="true" aria-labelledby="plumbing-modal-title" onClick={event => event.stopPropagation()}>
    <div className="plumbing-modal-head"><div><span className="section-index">ИСХОДНЫЙ САНТЕХНИЧЕСКИЙ ЧЕРТЁЖ · {sheet}</span><h2 id="plumbing-modal-title">{group.title}</h2></div><button aria-label="Закрыть" onClick={onClose}>×</button></div>
    <div className="plumbing-modal-body"><div className="plumbing-detail-art"><SourceVector encoded={plumbingVectors[sheet as keyof typeof plumbingVectors]} alt={`Исходный план выводов ${sheet}`} /></div>
      <div className="plumbing-detail-list"><h3>Спецификация по {sheet}</h3><p>Графика взята из рабочего листа. Размеры на нём проектные, от чистового пола, требуют контрольных замеров.</p>
        {group.fixtures.map(item => <div className="fixture-row" key={item.mark}><span className="fixture-mark">{item.mark}</span><span>{item.name ?? 'Неясная строка ведомости'}</span><b>{item.quantity ?? '?'}</b></div>)}
        <p className="source-note">Точки на общем плане только открывают эту схему. A-22–A-29 выполнены в масштабе 1:35; их координаты пока не сопоставлены с полной моделью здания.</p>
      </div></div>
  </section></div>
}

export default function App() {
  const [floorId, setFloorId] = useState<typeof floorIds[number]>('level-1')
  const [displayMode, setDisplayMode] = useState<'3d' | '2d'>('3d')
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null)
  const [infoExpanded, setInfoExpanded] = useState(false)
  const [openPlumbingSheet, setOpenPlumbingSheet] = useState<string | null>(null)
  const floor = useMemo(() => project.floors.find(item => item.id === floorId)!, [floorId])
  const data = plans.floors[floorId]
  const chooseFloor = (id: typeof floorIds[number]) => { setFloorId(id); setSelectedRoom(null); setOpenPlumbingSheet(null) }
  const selectRoom = (number: number) => setSelectedRoom(previous => previous === number ? null : number)
  return <div className="app-shell">
    <nav className="side-rail" aria-label="Навигация"><a href="/" aria-label="Villa Como v2" className="brand-mark">V<span>.</span>C</a><div className="rail-rule"><i /><i /><i /></div><span className="rail-caption">MÈTRE<br/>2026</span></nav>
    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumbs"><span>VILLA COMO</span><i>/</i><b>INTERACTIVE 3D</b><i>/</i><span>ЭТАП 3.5 · ПАКЕТ Б</span></div>
        <div className="header-actions"><span className="status-light" /> <span>ВНЕШНИЙ ОБЛИК · ДЕМОНСТРАЦИОННАЯ ВЕРСИЯ</span> <a href="https://github.com/RadamirSS/Villa_como_v2" target="_blank" rel="noreferrer">GitHub ↗</a></div>
      </header>
      <div className="page-content">
        <div className="intro">
          <div className="eyebrow"><span className="eyebrow-line" /> SOURCE-DRIVEN EXTERIOR CONCEPT <span className="muted">/ 3.5 B</span></div>
          <h1>Villa <em>Como.</em></h1>
          <div className="intro-bottom"><p>3D-сцена строится из стеновых контуров PDF. Внешний облик восстановлен как демонстрационная концепция поверх архитектуры A-14–A-17. Есть объёмные фасады, остекление, терраса и крыша; для отсутствующих фасадных чертежей реконструкция помечена как условная. Исходные 2D и 3D-планы сохранены.</p><span className="intro-step"><span>ЭТАП ПРОЕКТА</span><b>03<small>/03</small></b><small>Внешний облик · пакет Б</small></span></div>
        </div>
        <section className="metrics" aria-label="Показатели проекта">
          <div><span>УРОВНИ</span><strong>04</strong><small>3 этажа и гараж</small></div>
          <div><span>ПЛОЩАДЬ ПО ВЕДОМОСТЯМ</span><strong>{area(totalScheduledArea)}</strong><small>без подмены геометрическими расчётами</small></div>
          <div><span>ПОЗИЦИИ ПОМЕЩЕНИЙ</span><strong>44</strong><small>7 + 19 + 13 + 5</small></div>
          <div><span>КОНЦЕПЦИЯ ФАСАДОВ</span><strong>04</strong><small>3 уровня и отдельный гараж</small></div>
        </section>
        <section className="architecture-section">
          <div className="section-head"><div><span className="section-index">01 / ARCHITECTURAL WORKSPACE</span><h2>3D-модель и проектные 2D-чертежи</h2></div><div className="design-mode-tabs" role="tablist" aria-label="Формат просмотра"><button role="tab" aria-selected={displayMode === '3d'} className={displayMode === '3d' ? 'selected' : ''} onClick={() => setDisplayMode('3d')}>◈ 3D модель</button><button role="tab" aria-selected={displayMode === '2d'} className={displayMode === '2d' ? 'selected' : ''} onClick={() => setDisplayMode('2d')}>▤ 2D чертёж</button></div></div>
          <div className="floor-navigation" role="tablist" aria-label="Выбор этажа">
            {floorIds.map((id, i) => <button role="tab" aria-selected={floorId === id} key={id} className={'floor-choice ' + (id === floorId ? 'active' : '')} onClick={() => chooseFloor(id)}>
              <b>{id === 'garage' ? 'G' : String(i + 1).padStart(2, '0')}</b><span>{id === 'garage' ? 'Гараж' : (i + 1) + ' этаж'}</span><small>{area(project.floors.find(f => f.id === id)!.scheduleAreaM2)}</small>
            </button>)}
          </div>
          <div className="workspace-grid">
            {displayMode === '3d' ? <Villa3D floorId={floorId} selectedRoom={selectedRoom} onSelectRoom={selectRoom} /> : <PlanViewer floor={floor} data={data} selectedRoom={selectedRoom} onSelectRoom={selectRoom} onOpenPlumbing={setOpenPlumbingSheet} />}
            <InfoPanel floor={floor} data={data} selectedRoom={selectedRoom} onSelectRoom={selectRoom} onOpenPlumbing={setOpenPlumbingSheet} />
          </div>
        </section>
        <section className="provenance-section">
          <div><span className="section-index">02 / PROVENANCE</span><h2>Проверяемые источники</h2></div>
          <div className="sources-grid">
            <div><span>ОБМЕРНЫЙ ПЛАН</span><b>{data.measuredSheet}</b><p>Первоначальные размеры и отметки</p></div>
            <div><span>ПЛАН МОНТАЖА</span><b>{data.installSheet}</b><p>Возводимые перегородки и зашивки</p></div>
            <div><span>ЧИСТОВЫЕ ПРОЁМЫ</span><b>{data.finalSheet}</b><p>Контуры стен, двери, чистовые грани</p></div>
            <div><span>МЕБЕЛЬНЫЙ ПЛАН</span><b>{data.furnitureSheet}</b><p>Мебель и планировочные позиции</p></div>
          </div>
        </section>
        <div className="audit-note"><div><span>!</span><strong>Внешний облик · пакет Б, граница точности</strong></div><p>Для 368 стеновых полигонов созданы устойчивые ID, восемь опорных размеров из A‑03/A‑05/A‑06/A‑15/A‑16 проверены по геометрии векторных размерных линий. Все <b>33 дверные марки</b> связаны с источниковыми символами открытых полотен и ведомостями их ширины/высоты. Для <b>18 проёмов</b> программа однозначно сопоставляет дверное полотно с просветом на исходном плане; оставшиеся 15 пока не разрешены. Точное положение створки в 3D воспроизводит <b>условную открытую ориентацию на чертеже</b>. Конструктивные перекрытия, лестничные марши, оконные высоты, мансардная кровля и привязка гаража к участку остаются неподтверждёнными. Эти части не подменяются придуманной BIM-геометрией. <b>Пакет А требует дальнейшей инженерной доработки</b> до заявления «в точности по проекту».</p></div>
        <div className="bottom-actions"><a href="https://github.com/RadamirSS/Villa_como_v2/tree/main/docs" target="_blank" rel="noreferrer">Методика и незакрытые вопросы ↗</a><button onClick={() => setInfoExpanded(!infoExpanded)}>{infoExpanded ? 'Скрыть инженерные требования' : 'Что необходимо для BIM-точности?'} <span>{infoExpanded ? '−' : '+'}</span></button></div>
        {infoExpanded && <div className="expanded-note">Следующий инженерный шаг: закрыть все размерные цепочки каждого этажа, определить геометрию оставшихся 15 дверных проёмов, зарегистрировать окна, лестничные марши и отверстия в перекрытиях; получить фасады, разрезы, конструкцию крыши и топосъёмку. Тогда можно согласовать одну метрическую пространственную модель для 2D и 3D.</div>}
        <footer><span>VILLA COMO / DIGITAL DESIGN</span><span>MÈTRE · Рабочая документация</span><span>© 2026</span></footer>
      </div>
    </main>
    {openPlumbingSheet && <PlumbingDetail sheet={openPlumbingSheet} onClose={() => setOpenPlumbingSheet(null)} />}
  </div>
}
