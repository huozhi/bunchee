import data from './data.json'
import text from './tpl.txt?raw'
import './style.css'
import addon from './addon.node'
import wasm from './empty.wasm'
import dep from 'unbundle-dep'
export const answer = dep.answer
export { data, text, addon, wasm }
