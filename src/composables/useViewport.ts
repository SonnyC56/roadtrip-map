import { ref } from "vue"

// Shared, module-level so every component reads the same values.
const MOBILE_Q = "(max-width: 899px)"
const PORTRAIT_Q = "(orientation: portrait)"
const isMobile = ref(false)
const isPortrait = ref(false)
let bound = false

function bind() {
  if (bound || typeof window === "undefined") return
  bound = true
  const mq = window.matchMedia(MOBILE_Q)
  const pq = window.matchMedia(PORTRAIT_Q)
  const update = () => {
    isMobile.value = mq.matches
    isPortrait.value = pq.matches
  }
  update()
  mq.addEventListener("change", update)
  pq.addEventListener("change", update)
}

export function useViewport() {
  bind()
  return { isMobile, isPortrait }
}
