// Served under `style-src 'self'`: inline <style> elements are blocked.
// A plain <style> element proves the policy is enforced, so the bundle's
// styles applying is not just a page without CSP.
const probe = document.createElement('style')
probe.textContent = '.probe { color: rgb(9, 9, 9); }'
document.head.appendChild(probe)

await import('/dist/index.js')

const color = (selector) =>
  getComputedStyle(document.querySelector(selector)).color
document.getElementById('result').textContent = JSON.stringify({
  styled: color('.styled'),
  probe: color('.probe'),
  adopted: document.adoptedStyleSheets.length,
})
