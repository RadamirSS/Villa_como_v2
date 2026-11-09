import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import de from './locales/de.json'
export const languages = [ ['ru','Русский'], ['en','English'], ['fr','Français'], ['it','Italiano'], ['de','Deutsch'] ] as const
export type Language = typeof languages[number][0]
const supported = (value: string | null): value is Language => languages.some(([code]) => code === value)
let initial: Language = 'ru'
try { const saved = localStorage.getItem('villa-como-language'); if (supported(saved)) initial = saved } catch { /* Storage can be disabled. */ }
void i18n.use(initReactI18next).init({ resources: {ru:{translation:ru},en:{translation:en},fr:{translation:fr},it:{translation:it},de:{translation:de}}, lng:initial, fallbackLng:'ru', supportedLngs:languages.map(([code])=>code), keySeparator:false, nsSeparator:false, interpolation:{escapeValue:false}, returnEmptyString:false, initAsync:false })
i18n.on('languageChanged', language => {
 if (typeof document === 'undefined') return
 document.documentElement.lang = language
 try { localStorage.setItem('villa-como-language',language) } catch { /* Optional persistence. */ }
 document.title = `Villa Como · ${tx('Интерактивная модель виллы')}`
})
if (typeof document !== 'undefined') document.documentElement.lang = initial
// Exact resource keys cover static copy. Phrase matching handles composed source
// labels (room + fixture + circuit mark) without changing immutable project IDs.
const phrases = Object.keys(ru).filter(key => /[а-яё]/i.test(key)).sort((a,b)=>b.length-a.length)
const phraseKeys = new Map(phrases.map(key => [key.toLocaleLowerCase('ru'), key]))
const escape = (s:string) => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const phrasePattern = new RegExp('(?<![а-яё])(?:'+phrases.map(escape).join('|')+')(?![а-яё])','giu')
export function tx<T>(value:T):T {
 if (typeof value !== 'string' || i18n.language === 'ru') return value
 const text=value.trim()
 if (i18n.exists(text)) return value.replace(text,String(i18n.t(text))) as T
 return value.replace(phrasePattern, match => {
  const key=phraseKeys.get(match.toLocaleLowerCase('ru'))!
  const translated=String(i18n.t(key))
  return match===match.toLocaleUpperCase('ru')&&match.length>2 ? translated.toLocaleUpperCase(i18n.language) : translated
 }) as T
}
export default i18n

if (typeof document !== "undefined") document.title = `Villa Como · ${tx("Интерактивная модель виллы")}`
