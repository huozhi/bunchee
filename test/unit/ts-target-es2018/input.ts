export async function asyncFunc() {
  await new Promise((r) => r(2))
}
export const spread = { ...{ x: 1, y: 2 } }
