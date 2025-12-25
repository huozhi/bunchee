export async function makeObject(value) {
  await Promise.resolve()
  return { value, ...(value ? { extra: true } : {}) }
}
