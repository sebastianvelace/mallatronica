let toastTimer: ReturnType<typeof setTimeout> | undefined

/** One persistent live region, so assistive technology announces every message. */
export function showToast(title: string, message: string) {
  let toast = document.querySelector<HTMLDivElement>('.requirement-toast')
  if (!toast) {
    toast = document.createElement('div')
    toast.className = 'requirement-toast'
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    toast.setAttribute('aria-atomic', 'true')
    document.body.appendChild(toast)
  }
  const heading = document.createElement('strong')
  const detail = document.createElement('span')
  heading.textContent = title
  detail.textContent = message
  toast.replaceChildren(heading, detail)
  toast.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast!.hidden = true }, 4200)
}
