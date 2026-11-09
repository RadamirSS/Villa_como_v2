import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { project } from './domain/project'
import rawPlans from './data/architectural-plans.json'
import rawGeometry from './data/architectural-geometry.json'
import compressedTraces from './data/source-traces.json'
import plumbingRegister from './data/plumbing-register.json'
import { LazySourceVector as SourceVector } from './components/SourceVector'
import Villa3D from './components/Villa3D'
import { useLighting } from './domain/useLighting'
import OverlayPanel,{type ShowroomPanel}from './components/OverlayPanel'
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
            {layers.furniture ? <SourceVector key={floor.id} source="furniture" sheet={floor.id} alt={`Векторный мебельный план ${data.furnitureSheet}`} className="furniture-source-art" /> : !!svg && <div className="vector-ink" dangerouslySetInnerHTML={{ __html: svg }} />}
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
  return <OverlayPanel title={`${sheet} · ${group.title}`} onClose={onClose} wide>
    <div className="plumbing-modal-body"><div className="plumbing-detail-art"><SourceVector source="plumbing" sheet={sheet} alt={`Исходный план выводов ${sheet}`} /></div>
      <div className="plumbing-detail-list"><h3>Спецификация по {sheet}</h3><p>Графика взята из рабочего листа. Размеры на нём проектные, от чистового пола, требуют контрольных замеров.</p>
        {group.fixtures.map(item => <div className="fixture-row" key={item.mark}><span className="fixture-mark">{item.mark}</span><span>{item.name ?? 'Неясная строка ведомости'}</span><b>{item.quantity ?? '?'}</b></div>)}
        <p className="source-note">Точки на общем плане только открывают эту схему. A-22–A-29 выполнены в масштабе 1:35; их координаты пока не сопоставлены с полной моделью здания.</p>
      </div></div>
  </OverlayPanel>
}

export default function App() {
  const lighting=useLighting()
  const [floorId,setFloorId]=useState<typeof floorIds[number]>('level-1')
  const [selectedRoom,setSelectedRoom]=useState<number|null>(null)
  const [panel,setPanel]=useState<ShowroomPanel>(null)
  const [openPlumbingSheet,setOpenPlumbingSheet]=useState<string|null>(null)
  const [floorSelectionRevision,setFloorSelectionRevision]=useState(0)
  const floor=useMemo(()=>project.floors.find(item=>item.id===floorId)!,[floorId]),data=plans.floors[floorId]
  const chooseFloor=(id:typeof floorIds[number])=>{setFloorSelectionRevision(v=>v+1);setFloorId(id);setSelectedRoom(null)}
  const selectRoom=(number:number|null)=>setSelectedRoom(previous=>previous===number?null:number)
  const openPlumbing=(sheet:string)=>{setPanel(null);setOpenPlumbingSheet(sheet)}
  return <div className="showroom-app" data-time={lighting.time}>
    <header className="showroom-header"><a href="/" className="showroom-brand">VILLA COMO</a><span className="showroom-location"><span aria-hidden="true">⌖</span> Lago di Como, Italia</span><span className="showroom-demo" title="Демонстрационный режим"><i/><span>Демо</span></span><button className="menu-button" aria-label="Открыть меню" onClick={()=>setPanel('menu')}><span/><span/></button></header>
    <main className="showroom-main" aria-label="Интерактивная модель виллы">
      <Villa3D lighting={lighting} floorSelectionRevision={floorSelectionRevision} floorId={floorId} selectedRoom={selectedRoom} onSelectRoom={selectRoom} onChooseFloor={chooseFloor} panel={panel} onPanel={setPanel}/>
    </main>
    <footer className="showroom-footer"><b>MÈTRE</b><span className="footer-source">Архитектура пространства. Интеллект света.</span><button onClick={()=>setPanel('passport')}>Паспорт модели <span aria-hidden="true">↗</span></button><small>v 2.6</small></footer>
    {(panel==='menu'||panel==='plans'||panel==='passport')&&<OverlayPanel title={panel==='menu'?'Ваш дом':panel==='plans'?'Чертежи':'Паспорт модели'} onClose={()=>setPanel(null)} wide={panel==='plans'}>
      {panel==='menu'?<><p className="panel-intro">Всё для управления домом — в одном месте.</p><nav className="showroom-menu" aria-label="Меню дома">{([['scenarios','Сценарии','Свет одним нажатием'],['rooms','Свет в комнатах','Комнаты и виды освещения'],['view','Настройки вида','Слои и режимы модели'],['plans','Чертежи','Исходные планы и сантехника'],['passport','Паспорт модели','Источники и данные проекта']]as const).map(([id,title,description])=><button key={id} onClick={()=>setPanel(id)}><span><b>{title}</b><small>{description}</small></span><span aria-hidden="true">↗</span></button>)}</nav><p className="quiet-note">Демонстрация умного дома. Оборудование не подключено.</p></>:<>
        <label className="panel-floor-select">Уровень<select value={floorId} onChange={e=>chooseFloor(e.target.value as typeof floorId)}>{floorIds.map(id=><option value={id} key={id}>{id==='garage'?'Гараж':id==='level-1'?'1 этаж':id==='level-2'?'2 этаж':'3 этаж'}</option>)}</select></label>
        {panel==='plans'?<PlanViewer floor={floor} data={data} selectedRoom={selectedRoom} onSelectRoom={selectRoom} onOpenPlumbing={openPlumbing}/>:<><InfoPanel floor={floor} data={data} selectedRoom={selectedRoom} onSelectRoom={selectRoom} onOpenPlumbing={openPlumbing}/><details className="panel-details"><summary>Геометрический контроль</summary>{rawGeometry.floors[floorId].calibrationChecks.map((check,index)=><p key={index}>{check.sheet} · {check.label}: <b>{check.dimensionMm} мм</b> · расхождение с масштабом предпросмотра {check.residualAtDisplayScalePct.toFixed(2)}%</p>)}<p>Проверки размерных линий PDF не подтверждают точность всей модели.</p></details><details className="panel-details"><summary>Источники и границы точности</summary><p>Планы MÈTRE: {data.measuredSheet}, {data.installSheet}, {data.finalSheet}, {data.furnitureSheet}. Свет — A-34–A-37. Расстановка, материалы, кровля и участок содержат демонстрационные допущения. Модель не является утверждённым BIM-проектом или монтажной схемой проводки.</p><p>Левая часть A-35 не содержит проектных групп света: соответствующие группы помечены как демо. Физическое оборудование не подключено.</p><a href="https://github.com/RadamirSS/Villa_como_v2/pull/1" target="_blank" rel="noreferrer">Документация и изменения ↗</a></details></>}
      </>}
    </OverlayPanel>}
    {openPlumbingSheet&&<PlumbingDetail sheet={openPlumbingSheet} onClose={()=>setOpenPlumbingSheet(null)}/>}
  </div>
}
