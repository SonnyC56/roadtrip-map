import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

export interface VirtualScrollOptions {
  itemWidth: number // Width of each item in pixels
  itemHeight: number // Height of each item in pixels
  buffer: number // Number of items to render outside visible area (for smooth scrolling)
}

export function useVirtualScroll<T>(
  items: Ref<T[]>,
  containerRef: Ref<HTMLElement | null>,
  options: VirtualScrollOptions
) {
  const scrollLeft = ref(0)
  const containerWidth = ref(0)

  // Calculate visible range
  const visibleRange = computed(() => {
    const startIndex = Math.max(0, Math.floor(scrollLeft.value / options.itemWidth) - options.buffer)
    const visibleCount = Math.ceil(containerWidth.value / options.itemWidth) + options.buffer * 2
    const endIndex = Math.min(items.value.length, startIndex + visibleCount)

    return {
      startIndex,
      endIndex,
      visibleCount
    }
  })

  // Only return items that should be rendered
  const visibleItems = computed(() => {
    const { startIndex, endIndex } = visibleRange.value
    return items.value.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
      offsetLeft: (startIndex + index) * options.itemWidth
    }))
  })

  // Total width of all items
  const totalWidth = computed(() => items.value.length * options.itemWidth)

  // Handle scroll event
  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement
    scrollLeft.value = target.scrollLeft
  }

  // Handle resize
  const handleResize = () => {
    if (containerRef.value) {
      containerWidth.value = containerRef.value.clientWidth
    }
  }

  onMounted(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    visibleItems,
    totalWidth,
    handleScroll,
    visibleRange
  }
}
