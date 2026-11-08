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
  if (error) return <div className="source-vector-state">Не удалось показать исходный чертёж: {error}</div>
  if (!url) return <div className="source-vector-state">Загрузка векторного чертежа…</div>
  return <img className={className} src={url} alt={alt} draggable={false}/>
}
