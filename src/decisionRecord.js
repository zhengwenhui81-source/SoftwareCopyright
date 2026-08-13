const STORAGE_KEY = 'thick_plate_decision_records'
export const DECISION_RECORD_CHANGED = 'decision-record-changed'
const clone = (value) => JSON.parse(JSON.stringify(value))
function read(){try{const data=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
export function getDecisionRecords(){return clone(read())}
export function saveDecisionRecord(decision){if(!decision?.id)return{saved:false,reason:'invalid'};const records=read();const existing=records.find(item=>item.id===decision.id);if(existing)return{saved:false,reason:'duplicate',record:clone(existing)};records.unshift(clone(decision));window.localStorage.setItem(STORAGE_KEY,JSON.stringify(records));window.dispatchEvent(new CustomEvent(DECISION_RECORD_CHANGED,{detail:clone(decision)}));return{saved:true,reason:'saved',record:clone(decision)}}
