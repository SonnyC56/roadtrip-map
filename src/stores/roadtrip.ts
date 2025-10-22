import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TimelinePoint {
  point: string
  time: string
}

export interface Visit {
  hierarchyLevel: number
  probability: number
  topCandidate: {
    placeId: string
    semanticType: string
    probability: number
    placeLocation: {
      latLng: string
    }
  }
}

export interface Activity {
  start: { latLng: string }
  end: { latLng: string }
  distanceMeters: number
  probability?: number
  topCandidate?: {
    type: string
    probability: number
  }
}

export interface MediaItem {
  id: string
  segmentIndex: number
  type: 'photo' | 'video' | '360-photo' | '360-video'
  url: string
  thumbnail?: string
  caption?: string
  timestamp: string
  location?: {
    lat: number
    lng: number
  }
}

export interface Comment {
  id: string
  segmentIndex: number
  author: string
  text: string
  timestamp: string
  rating?: number
}

export interface Segment {
  startTime: string
  endTime: string
  timelinePath?: TimelinePoint[]
  visit?: Visit
  activity?: Activity
  media?: MediaItem[]
  comments?: Comment[]
}

export const useRoadTripStore = defineStore('roadtrip', () => {
  // State
  const segments = ref<Segment[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  // UI State
  const selectedSegmentIndex = ref<number | null>(null)
  const searchQuery = ref('')
  const dateRange = ref<[Date, Date] | null>(null)
  const showMediaGallery = ref(false)
  const selectedMediaIndex = ref(0)

  // Timeline Playback
  const timelineTimestamp = ref<number | null>(null)
  const isTimelineModeActive = ref(false)

  // Media and comments storage
  const allMedia = ref<MediaItem[]>([])
  const allComments = ref<Comment[]>([])

  // Computed
  const totalPoints = computed(() => {
    return segments.value.reduce((sum, segment) => {
      return sum + (segment.timelinePath?.length || 0)
    }, 0)
  })

  const totalVisits = computed(() => {
    return segments.value.filter(s => s.visit).length
  })

  const totalDistance = computed(() => {
    return segments.value.reduce((sum, segment) => {
      return sum + (segment.activity?.distanceMeters || 0)
    }, 0)
  })

  const distanceMiles = computed(() => {
    return Math.round(totalDistance.value / 1609.34)
  })

  const distanceKm = computed(() => {
    return Math.round(totalDistance.value / 1000)
  })

  const filteredSegments = computed(() => {
    let filtered = segments.value

    // Filter by search query
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(segment => {
        // Search in visit locations
        if (segment.visit?.topCandidate.semanticType.toLowerCase().includes(query)) {
          return true
        }
        // Search in timeline points (could add place names here if we have them)
        return false
      })
    }

    // Filter by date range
    if (dateRange.value) {
      const [start, end] = dateRange.value
      filtered = filtered.filter(segment => {
        const segmentDate = new Date(segment.startTime)
        return segmentDate >= start && segmentDate <= end
      })
    }

    return filtered
  })

  const selectedSegment = computed(() => {
    if (selectedSegmentIndex.value === null) return null
    return segments.value[selectedSegmentIndex.value]
  })

  const segmentMedia = computed(() => {
    if (selectedSegmentIndex.value === null) return []
    return allMedia.value.filter(m => m.segmentIndex === selectedSegmentIndex.value)
  })

  const segmentComments = computed(() => {
    if (selectedSegmentIndex.value === null) return []
    return allComments.value.filter(c => c.segmentIndex === selectedSegmentIndex.value)
  })

  // Timeline playback - get segments up to current timestamp
  const timelineSegments = computed(() => {
    if (!isTimelineModeActive.value || timelineTimestamp.value === null) {
      return filteredSegments.value
    }

    return segments.value.filter(segment => {
      const segmentStart = new Date(segment.startTime).getTime()
      return segmentStart <= timelineTimestamp.value!
    })
  })

  // Actions
  async function loadData() {
    try {
      loading.value = true
      const response = await fetch('/roadtrip2025.json')
      const data = await response.json()
      segments.value = data.semanticSegments

      // Calculate initial date range
      if (segments.value.length > 0) {
        const dates = segments.value.map(s => new Date(s.startTime))
        dateRange.value = [
          new Date(Math.min(...dates.map(d => d.getTime()))),
          new Date(Math.max(...dates.map(d => d.getTime())))
        ]
      }

      // Load media and comments from localStorage
      loadMediaFromStorage()
      loadCommentsFromStorage()

      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load data'
      console.error('Error loading data:', e)
    } finally {
      loading.value = false
    }
  }

  function addMedia(media: Omit<MediaItem, 'id'>) {
    const newMedia: MediaItem = {
      ...media,
      id: `media-${Date.now()}-${Math.random()}`
    }
    allMedia.value.push(newMedia)
    saveMediaToStorage()
  }

  function removeMedia(id: string) {
    allMedia.value = allMedia.value.filter(m => m.id !== id)
    saveMediaToStorage()
  }

  function addComment(comment: Omit<Comment, 'id' | 'timestamp'>) {
    const newComment: Comment = {
      ...comment,
      id: `comment-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString()
    }
    allComments.value.push(newComment)
    saveCommentsToStorage()
  }

  function removeComment(id: string) {
    allComments.value = allComments.value.filter(c => c.id !== id)
    saveCommentsToStorage()
  }

  function selectSegment(index: number | null) {
    selectedSegmentIndex.value = index
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setDateRange(range: [Date, Date] | null) {
    dateRange.value = range
  }

  function openMediaGallery(mediaIndex = 0) {
    selectedMediaIndex.value = mediaIndex
    showMediaGallery.value = true
  }

  function closeMediaGallery() {
    showMediaGallery.value = false
  }

  function setTimelineTimestamp(timestamp: number | null) {
    timelineTimestamp.value = timestamp
  }

  function activateTimelineMode() {
    isTimelineModeActive.value = true
    timelineTimestamp.value = new Date('2025-08-10').getTime()
  }

  function deactivateTimelineMode() {
    isTimelineModeActive.value = false
    timelineTimestamp.value = null
  }

  // Storage helpers
  function saveMediaToStorage() {
    localStorage.setItem('roadtrip-media', JSON.stringify(allMedia.value))
  }

  function loadMediaFromStorage() {
    const stored = localStorage.getItem('roadtrip-media')
    if (stored) {
      try {
        allMedia.value = JSON.parse(stored)
      } catch (e) {
        console.error('Failed to load media from storage:', e)
      }
    }
  }

  function saveCommentsToStorage() {
    localStorage.setItem('roadtrip-comments', JSON.stringify(allComments.value))
  }

  function loadCommentsFromStorage() {
    const stored = localStorage.getItem('roadtrip-comments')
    if (stored) {
      try {
        allComments.value = JSON.parse(stored)
      } catch (e) {
        console.error('Failed to load comments from storage:', e)
      }
    }
  }

  return {
    // State
    segments,
    loading,
    error,
    selectedSegmentIndex,
    searchQuery,
    dateRange,
    showMediaGallery,
    selectedMediaIndex,
    allMedia,
    allComments,
    timelineTimestamp,
    isTimelineModeActive,

    // Computed
    totalPoints,
    totalVisits,
    totalDistance,
    distanceMiles,
    distanceKm,
    filteredSegments,
    selectedSegment,
    segmentMedia,
    segmentComments,
    timelineSegments,

    // Actions
    loadData,
    addMedia,
    removeMedia,
    addComment,
    removeComment,
    selectSegment,
    setSearchQuery,
    setDateRange,
    openMediaGallery,
    closeMediaGallery,
    setTimelineTimestamp,
    activateTimelineMode,
    deactivateTimelineMode,
  }
})
