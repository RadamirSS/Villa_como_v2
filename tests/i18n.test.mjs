import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {build} from 'esbuild'
const codes=['ru','en','fr','it','de']
const dictionaries=codes.map(code=>JSON.parse(readFileSync(new URL(`../src/i18n/locales/${code}.json`,import.meta.url))))
test('all five languages have matching, non-empty resources',()=>{
 const keys=Object.keys(dictionaries[0]).sort();assert(keys.length>350)
 for(const dictionary of dictionaries){assert.deepEqual(Object.keys(dictionary).sort(),keys);assert(Object.values(dictionary).every(v=>typeof v==='string'&&v.trim()))}
 for(const dictionary of dictionaries.slice(1))assert(Object.values(dictionary).every(v=>!/[а-яё]/iu.test(v)))
})
const bundle=await build({entryPoints:['src/i18n/index.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {default:i18n,tx}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
test('language changes translate static, dynamic and accessible labels while preserving IDs',async()=>{
 for(const code of codes.slice(1)){
  await i18n.changeLanguage(code)
  assert.notEqual(tx('Свет в комнатах'),'Свет в комнатах')
  assert(!/[а-яё]/iu.test(tx('Свет: Кухня')))
  assert(!/[а-яё]/iu.test(tx('Группа 12.1: Кухня · свет над островом')))
  assert.equal(tx('level-2:Б.1'),'level-2:Б.1')
  assert.equal(tx(12),12);assert.equal(tx(false),false)
  assert(tx('  Кухня  ').startsWith('  '))
 }
 await i18n.changeLanguage('ru');assert.equal(tx('Кухня'),'Кухня')
})
