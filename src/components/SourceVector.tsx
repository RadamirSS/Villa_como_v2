import { tx } from '../i18n'
import { useEffect, useState } from 'react'

/**
 * Decompress a sanitized, locally bundled PDF-sourced SVG into an image Blob URL.
 * The source is deliberately not rendered through dangerouslySetInnerHTML.
 * It is kept as source-art, not converted into invented furniture coordinates.
 */
export function useSourceVector(encoded: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!encoded) { setUrl(null); setError('Нет исходного слоя'); return }
    let live = true
    let blobUrl: string | null = null
    setUrl(null); setError(null)
    const unpack = async () => {
      const decoded = atob(encoded)
      const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0))
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
      return new Response(stream).text()
    }
    unpack().then(svg => {
      if (!live) return
      if (!svg.startsWith('<svg ') || /<script|<foreignObject|<image\b/i.test(svg)) {
        throw new Error('Недопустимое содержимое SVG')
      }
      blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      setUrl(blobUrl)
    }).catch(e => { if (live) setError(String(e)) })
    return () => { live = false; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [encoded])
  return { url, error }
}

export default function SourceVector({ encoded, alt, className = '' }: {
  encoded: string | undefined; alt: string; className?: string
}) {
  const { url, error } = useSourceVector(encoded)
  if (error) return <div className="source-vector-state">{tx("Не удалось показать исходный чертёж: ")}{tx(error)}</div>
  if (!url) return <div className="source-vector-state">{tx("Загрузка векторного чертежа…")}</div>
  return <img className={className} src={url} alt={tx(alt)} draggable={false}/>
}


/** Large source-art archives load only when the corresponding drawing opens. */
export function LazySourceVector({ source, sheet, alt, className }: {
  source: 'furniture' | 'plumbing'; sheet: string; alt: string; className?: string
}) {
  const [data, setData] = useState<{ source: string; sheet: string; encoded: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setError(null)
    const load = source === 'furniture' ? import('../data/furniture-vectors.json') : import('../data/plumbing-vectors.json')
    load.then(result => {
      const encoded = (result.default as Record<string, string>)[sheet]
      if (!encoded) throw new Error('Нет исходного слоя')
      if (live) setData({ source, sheet, encoded })
    }).catch(error => { if (live) setError(String(error)) })
    return () => { live = false }
  }, [source, sheet])
  if (error) return <div className="source-vector-state" role="alert">{tx("Не удалось загрузить чертёж: ")}{tx(error)}</div>
  if (!data || data.source !== source || data.sheet !== sheet) return <div className="source-vector-state" role="status">{tx("Загрузка исходного чертежа…")}</div>
  return <SourceVector encoded={data.encoded} alt={tx(alt)} className={className}/>
}
