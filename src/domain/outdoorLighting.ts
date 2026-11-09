/** Demonstration only: no outdoor circuit is supplied in the source project. */
export const courtyardEvidence = 'demo-not-in-source-project' as const
export function courtyardForScenario(id:string):boolean { return id !== 'away' }
export function restoredCourtyard(saved:unknown):boolean {
 if(saved&&typeof saved==='object'&&'version' in saved&&saved.version===1&&'courtyard' in saved&&typeof saved.courtyard==='boolean')return saved.courtyard
 return true
}
