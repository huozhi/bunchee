import {add} from './math'

const sum: number = add(1, 2)

const obj = {a: 1, b: 2}
const clone = {...obj}

export async function asyncFunc() { await new Promise(r => r(1)) }

export {clone}
export default sum
