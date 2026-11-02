export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Formats an ISO date (YYYY-MM-DD) without shifting it to the viewer's time zone. */
export function formatIsoDate(value: string) {
  return dateFormat.format(new Date(`${value}T00:00:00Z`))
}
