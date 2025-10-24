import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { majorDestinations, type Destination } from '../data/destinations'
import { TRIP_START_DATE, TRIP_END_DATE } from '../constants/trip'

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
  const dataSource = ref<'default' | 'custom'>('default')

  // UI State
  const selectedSegmentIndex = ref<number | null>(null)
  const searchQuery = ref('')
  const dateRange = ref<[Date, Date] | null>(null)
  const showMediaGallery = ref(false)
  const selectedMediaIndex = ref(0)

  // Layer visibility
  const layerVisibility = ref({
    baselineRoute: true,
    routeSegments: true,
    visitMarkers: true,
    destinationIcons: true
  })

  // Timeline Playback
  const timelineTimestamp = ref<number | null>(null)
  const isTimelineModeActive = ref(false)

  // Day-by-Day View
  const viewMode = ref<'timeline' | 'day-by-day'>('timeline')
  const selectedDay = ref(1) // Day 1-59

  // Media and comments storage
  const allMedia = ref<MediaItem[]>([])
  const allComments = ref<Comment[]>([])

  // Destinations
  const destinations = ref<Destination[]>([...majorDestinations])

  // Cache for destination proximity (segment startTime -> destination indices)
  const segmentDestinationCache = ref<Map<string, Set<number>>>(new Map())

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

  // Dynamic trip dates based on loaded data
  const tripStartDate = computed(() => {
    if (segments.value.length === 0) return TRIP_START_DATE

    const dates = segments.value.map(s => new Date(s.startTime).getTime())
    return new Date(Math.min(...dates))
  })

  const tripEndDate = computed(() => {
    if (segments.value.length === 0) return TRIP_END_DATE

    const dates = segments.value.map(s => new Date(s.endTime).getTime())
    return new Date(Math.max(...dates))
  })

  const tripDurationMs = computed(() => {
    return tripEndDate.value.getTime() - tripStartDate.value.getTime()
  })

  const tripTotalDays = computed(() => {
    return Math.ceil(tripDurationMs.value / (24 * 60 * 60 * 1000))
  })

  // Dynamic month colors - generates colors for each month present in the data
  // Uses consistent calendar-based colors, or year-based colors for multi-year datasets
  const monthColors = computed(() => {
    const colorPalette = [
      '#E53935', // Vibrant Red (Jan / Year 1)
      '#00ACC1', // Cyan (Feb / Year 2)
      '#FB8C00', // Deep Orange (Mar / Year 3)
      '#43A047', // Green (Apr / Year 4)
      '#D81B60', // Pink (May / Year 5)
      '#8E24AA', // Purple (Jun / Year 6)
      '#F06292', // Rose (Jul / Year 7)
      '#FDD835', // Bold Yellow (Aug / Year 8)
      '#1E88E5', // Vivid Blue (Sep / Year 9)
      '#C62828', // Deep Red (Oct / Year 10)
      '#7CB342', // Light Green (Nov / Year 11)
      '#6D4C41', // Brown (Dec / Year 12)
    ]

    if (segments.value.length === 0) {
      return { colorMap: new Map<string, string>(), sortedMonths: [], isMultiYear: false }
    }

    // Find all unique years and months in the data
    const yearsSet = new Set<number>()
    const monthsSet = new Set<string>()

    segments.value.forEach(segment => {
      const date = new Date(segment.startTime)
      const year = date.getFullYear()
      const month = date.getMonth()
      const monthKey = `${year}-${month}` // "2025-7" for Aug 2025

      yearsSet.add(year)
      monthsSet.add(monthKey)
    })

    const isMultiYear = yearsSet.size > 1
    const sortedYears = Array.from(yearsSet).sort()
    const sortedMonths = Array.from(monthsSet).sort()
    const colorMap = new Map<string, string>()

    if (isMultiYear) {
      // Multi-year dataset: assign one color per year
      sortedYears.forEach((year, yearIndex) => {
        const color = colorPalette[yearIndex % colorPalette.length] || '#666'

        // Assign this color to all months in this year
        for (let month = 0; month < 12; month++) {
          const monthKey = `${year}-${month}`
          colorMap.set(monthKey, color)
        }
      })
    } else {
      // Single year dataset: assign colors by calendar month (Jan=0, Feb=1, etc.)
      sortedMonths.forEach(monthKey => {
        const parts = monthKey.split('-')
        const month = parseInt(parts[1] || '0') // 0-11
        const color = colorPalette[month % colorPalette.length] || '#666'
        colorMap.set(monthKey, color)
      })
    }

    return { colorMap, sortedMonths, isMultiYear }
  })

  // Helper to get color for a date
  const getColorForDate = (date: Date): string => {
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    return monthColors.value.colorMap.get(monthKey) || '#666'
  }

  // Month boundaries as percentages for progress bar
  // Shows year labels for multi-year datasets, month labels for single-year datasets
  const monthBoundaries = computed(() => {
    const boundaries: Array<{ monthKey: string; name: string; percent: number; color: string }> = []
    const { isMultiYear, sortedMonths, colorMap } = monthColors.value

    if (isMultiYear) {
      // Multi-year: show year boundaries
      const yearsSet = new Set<string>()
      sortedMonths.forEach(monthKey => {
        const parts = monthKey.split('-')
        const year = parts[0] || '0'
        yearsSet.add(year)
      })

      const sortedYears = Array.from(yearsSet).sort()
      sortedYears.forEach(year => {
        const yearInt = parseInt(year)
        const yearEnd = new Date(yearInt + 1, 0, 1) // Jan 1st of next year

        // Calculate percentage of trip completed at the end of this year
        const percent = ((yearEnd.getTime() - tripStartDate.value.getTime()) / tripDurationMs.value) * 100

        // Use the first month of this year to get the color
        const monthKey = `${year}-0`
        const color = colorMap.get(monthKey) || '#666'

        boundaries.push({ monthKey: year, name: year, percent, color })
      })
    } else {
      // Single year: show month boundaries
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

      sortedMonths.forEach(monthKey => {
        const parts = monthKey.split('-')
        const year = parseInt(parts[0] || '0')
        const month = parseInt(parts[1] || '0')
        const monthEnd = new Date(year, month + 1, 1)

        // Calculate percentage of trip completed at the end of this month
        const percent = ((monthEnd.getTime() - tripStartDate.value.getTime()) / tripDurationMs.value) * 100

        const name = monthNames[month] || 'Unknown'
        const color = colorMap.get(monthKey) || '#666'

        boundaries.push({ monthKey, name, percent, color })
      })
    }

    return boundaries
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

  // Real-time stats based on timeline position
  const currentPoints = computed(() => {
    if (!isTimelineModeActive.value) return totalPoints.value

    return timelineSegments.value.reduce((sum, segment) => {
      return sum + (segment.timelinePath?.length || 0)
    }, 0)
  })

  const currentVisits = computed(() => {
    if (!isTimelineModeActive.value) return totalVisits.value

    return timelineSegments.value.filter(s => s.visit).length
  })

  const currentDistance = computed(() => {
    if (!isTimelineModeActive.value) return totalDistance.value

    return timelineSegments.value.reduce((sum, segment) => {
      return sum + (segment.activity?.distanceMeters || 0)
    }, 0)
  })

  const currentDistanceMiles = computed(() => {
    return Math.round(currentDistance.value / 1609.34)
  })

  const currentDistanceKm = computed(() => {
    return Math.round(currentDistance.value / 1000)
  })

  // Reached destinations based on timeline position (OPTIMIZED with cache)
  const reachedDestinations = computed(() => {
    if (!isTimelineModeActive.value || !timelineTimestamp.value) {
      return destinations.value.map(d => ({ ...d, reached: true }))
    }

    const currentSegments = timelineSegments.value
    const reachedDestIndices = new Set<number>()

    // Use cache for ultra-fast lookup (using startTime as key)
    currentSegments.forEach(segment => {
      const nearbyDests = segmentDestinationCache.value.get(segment.startTime)

      if (nearbyDests) {
        nearbyDests.forEach(destIndex => reachedDestIndices.add(destIndex))
      }
    })

    // Map to destination objects
    return destinations.value.map((dest, index) => ({
      ...dest,
      reached: reachedDestIndices.has(index)
    }))
  })

  // Day-by-day view computeds
  const selectedDaySegments = computed(() => {
    if (viewMode.value !== 'day-by-day') return []

    const dayStartTime = tripStartDate.value.getTime() + (selectedDay.value - 1) * 24 * 60 * 60 * 1000
    const dayEndTime = dayStartTime + 24 * 60 * 60 * 1000

    return segments.value.filter(segment => {
      const segmentStart = new Date(segment.startTime).getTime()
      return segmentStart >= dayStartTime && segmentStart < dayEndTime
    })
  })

  const selectedDayBounds = computed(() => {
    const daySegments = selectedDaySegments.value
    if (daySegments.length === 0) return null

    const coords: [number, number][] = []

    daySegments.forEach(segment => {
      // Add route coordinates
      if (segment.timelinePath && segment.timelinePath.length > 0) {
        segment.timelinePath.forEach(p => {
          const parts = p.point.replace(/°/g, '').split(', ')
          if (parts.length >= 2) {
            const lat = parseFloat(parts[0] || '0')
            const lng = parseFloat(parts[1] || '0')
            if (!isNaN(lat) && !isNaN(lng)) {
              coords.push([lat, lng])
            }
          }
        })
      }

      // Add visit coordinates
      if (segment.visit?.topCandidate?.placeLocation) {
        const parts = segment.visit.topCandidate.placeLocation.latLng
          .replace(/°/g, '')
          .split(', ')
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0] || '0')
          const lng = parseFloat(parts[1] || '0')
          if (!isNaN(lat) && !isNaN(lng)) {
            coords.push([lat, lng])
          }
        }
      }
    })

    return coords
  })

  const selectedDayDistance = computed(() => {
    return selectedDaySegments.value.reduce((sum, segment) => {
      return sum + (segment.activity?.distanceMeters || 0)
    }, 0)
  })

  const selectedDayDistanceMiles = computed(() => {
    return Math.round(selectedDayDistance.value / 1609.34)
  })

  const selectedDayVisits = computed(() => {
    return selectedDaySegments.value.filter(s => s.visit).length
  })

  // Helper function to calculate distance between two coordinates
  function getDistanceFromLatLng(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1)
    const dLng = deg2rad(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d
  }

  function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
  }

  // Build cache of which segments are near which destinations (for performance)
  function buildDestinationCache() {
    const cache = new Map<string, Set<number>>()

    segments.value.forEach((segment) => {
      const nearbyDests = new Set<number>()

      destinations.value.forEach((dest, destIndex) => {
        let isNear = false

        // Check visit locations
        if (segment.visit?.topCandidate?.placeLocation) {
          const parts = segment.visit.topCandidate.placeLocation.latLng
            .replace(/°/g, '')
            .split(', ')

          if (parts.length >= 2) {
            const lat = parseFloat(parts[0] as string)
            const lng = parseFloat(parts[1] as string)

            if (!isNaN(lat) && !isNaN(lng)) {
              const distance = getDistanceFromLatLng(
                dest.location.lat,
                dest.location.lng,
                lat,
                lng
              )
              if (distance < 50) isNear = true
            }
          }
        }

        // Check timeline path endpoints
        if (!isNear && segment.timelinePath && segment.timelinePath.length > 0) {
          const pointsToCheck = [
            segment.timelinePath[0],
            segment.timelinePath[segment.timelinePath.length - 1]
          ].filter(p => p !== undefined)

          for (const point of pointsToCheck) {
            const parts = point.point.replace(/°/g, '').split(', ')
            if (parts.length >= 2) {
              const lat = parseFloat(parts[0] as string)
              const lng = parseFloat(parts[1] as string)

              if (!isNaN(lat) && !isNaN(lng)) {
                const distance = getDistanceFromLatLng(
                  dest.location.lat,
                  dest.location.lng,
                  lat,
                  lng
                )
                if (distance < 50) {
                  isNear = true
                  break
                }
              }
            }
          }
        }

        if (isNear) {
          nearbyDests.add(destIndex)
        }
      })

      if (nearbyDests.size > 0) {
        cache.set(segment.startTime, nearbyDests)
      }
    })

    segmentDestinationCache.value = cache
    console.log('Built destination cache:', cache.size, 'segments with nearby destinations')
  }

  // Actions
  async function loadData() {
    try {
      loading.value = true
      const response = await fetch('/roadtrip2025_mod.json')
      const data = await response.json()
      segments.value = data.semanticSegments
      dataSource.value = 'default'

      // Calculate initial date range
      if (segments.value.length > 0) {
        const dates = segments.value.map(s => new Date(s.startTime))
        dateRange.value = [
          new Date(Math.min(...dates.map(d => d.getTime()))),
          new Date(Math.max(...dates.map(d => d.getTime())))
        ]
      }

      // Build destination proximity cache for performance (only for default data)
      buildDestinationCache()

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

  async function loadCustomData(jsonData: any) {
    try {
      loading.value = true

      // Validate that the data has the expected structure
      if (!jsonData.semanticSegments || !Array.isArray(jsonData.semanticSegments)) {
        throw new Error('Invalid JSON structure: missing semanticSegments array')
      }

      segments.value = jsonData.semanticSegments
      dataSource.value = 'custom'

      // Calculate initial date range
      if (segments.value.length > 0) {
        const dates = segments.value.map(s => new Date(s.startTime))
        dateRange.value = [
          new Date(Math.min(...dates.map(d => d.getTime()))),
          new Date(Math.max(...dates.map(d => d.getTime())))
        ]
      }

      // Don't build destination cache for custom data (no hardcoded destinations)
      // Reset destination cache
      segmentDestinationCache.value = new Map()

      // Load media and comments from localStorage
      loadMediaFromStorage()
      loadCommentsFromStorage()

      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load custom data'
      console.error('Error loading custom data:', e)
      throw e // Re-throw so UI can handle it
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
    timelineTimestamp.value = tripStartDate.value.getTime()
  }

  function deactivateTimelineMode() {
    isTimelineModeActive.value = false
    timelineTimestamp.value = null
  }

  // Day-by-day view actions
  function setViewMode(mode: 'timeline' | 'day-by-day') {
    viewMode.value = mode
    if (mode === 'timeline') {
      activateTimelineMode()
    }
  }

  function setSelectedDay(day: number) {
    selectedDay.value = Math.max(1, Math.min(tripTotalDays.value, day))
  }

  function nextDay() {
    if (selectedDay.value < tripTotalDays.value) {
      selectedDay.value++
    }
  }

  function previousDay() {
    if (selectedDay.value > 1) {
      selectedDay.value--
    }
  }

  // Layer visibility actions
  function toggleLayer(layer: keyof typeof layerVisibility.value) {
    layerVisibility.value[layer] = !layerVisibility.value[layer]
  }

  function setLayerVisibility(layer: keyof typeof layerVisibility.value, visible: boolean) {
    layerVisibility.value[layer] = visible
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
    dataSource,
    selectedSegmentIndex,
    searchQuery,
    dateRange,
    showMediaGallery,
    selectedMediaIndex,
    allMedia,
    allComments,
    timelineTimestamp,
    isTimelineModeActive,
    destinations,
    viewMode,
    selectedDay,
    layerVisibility,

    // Computed
    totalPoints,
    totalVisits,
    totalDistance,
    distanceMiles,
    distanceKm,
    tripStartDate,
    tripEndDate,
    tripDurationMs,
    tripTotalDays,
    monthColors,
    getColorForDate,
    monthBoundaries,
    filteredSegments,
    selectedSegment,
    segmentMedia,
    segmentComments,
    timelineSegments,
    currentPoints,
    currentVisits,
    currentDistance,
    currentDistanceMiles,
    currentDistanceKm,
    reachedDestinations,
    selectedDaySegments,
    selectedDayBounds,
    selectedDayDistance,
    selectedDayDistanceMiles,
    selectedDayVisits,

    // Actions
    loadData,
    loadCustomData,
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
    setViewMode,
    setSelectedDay,
    nextDay,
    previousDay,
    toggleLayer,
    setLayerVisibility,
  }
})
