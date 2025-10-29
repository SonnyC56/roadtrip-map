import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { majorDestinations, type Destination } from '../data/destinations'
import { TRIP_START_DATE, TRIP_END_DATE } from '../constants/trip'
import { db } from '../config/firebase'
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore'

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

export interface MediaComment {
  id: string
  author: string
  text: string
  timestamp: string
  rating?: number
}

// Lightweight version for map markers - only essential data
export interface MediaMarker {
  id: string
  segmentIndex: number
  type: 'photo' | 'video' | '360-photo' | '360-video'
  thumbnail?: string
  timestamp: string
  location?: {
    lat: number
    lng: number
    isInferred?: boolean
  }
}

// Full media item - loaded on demand
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
    isInferred?: boolean
  }
  exifData?: {
    camera?: string
    focalLength?: string
    iso?: string
    exposureTime?: string
  }
  comments?: MediaComment[]
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
    destinationIcons: true,
    mediaMarkers: true
  })

  // Media type filters
  const mediaTypeFilters = ref({
    photo: true,
    video: true,
    '360-photo': true,
    '360-video': true
  })

  // Timeline Playback
  const timelineTimestamp = ref<number | null>(null)
  const isTimelineModeActive = ref(false)

  // Day-by-Day View
  const viewMode = ref<'timeline' | 'day-by-day'>('timeline')
  const selectedDay = ref(1) // Day 1-59

  // Media and comments storage
  
  const allMediaMarkers = ref<MediaMarker[]>([]) // Lightweight data for map
  const loadedMediaDetails = ref<Map<string, MediaItem>>(new Map()) // Cache of full details
  const allMedia = ref<MediaItem[]>([]) // For backward compatibility during transition
  const allComments = ref<Comment[]>([])

  // Media viewer trigger - used to open media viewer from anywhere (e.g., map markers)
  const mediaToView = ref<{ mediaId: string; timestamp: number } | null>(null)

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

      // Load lightweight media markers and comments from Firestore
      await loadMediaMarkersFromFirestore()
      await loadCommentsFromFirestore()

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

      // Load lightweight media markers and comments from Firestore
      await loadMediaMarkersFromFirestore()
      await loadCommentsFromFirestore()

      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load custom data'
      console.error('Error loading custom data:', e)
      throw e // Re-throw so UI can handle it
    } finally {
      loading.value = false
    }
  }

  async function addMedia(media: Omit<MediaItem, 'id' | 'segmentIndex'>) {
    const segmentIndex = assignSegmentIndex(media.timestamp)
    const newMedia: MediaItem = {
      ...media,
      id: `media-${Date.now()}-${Math.random()}`,
      segmentIndex
    }

    // Add to legacy store for backward compatibility
    allMedia.value.push(newMedia)

    // Add lightweight marker
    allMediaMarkers.value.push({
      id: newMedia.id,
      segmentIndex: newMedia.segmentIndex,
      type: newMedia.type,
      thumbnail: newMedia.thumbnail,
      timestamp: newMedia.timestamp,
      location: newMedia.location
    })

    // Cache full details
    loadedMediaDetails.value.set(newMedia.id, newMedia)

    await saveMediaToFirestore(newMedia)
  }

  async function removeMedia(id: string) {
    allMedia.value = allMedia.value.filter(m => m.id !== id)
    allMediaMarkers.value = allMediaMarkers.value.filter(m => m.id !== id)
    loadedMediaDetails.value.delete(id)
    await deleteMediaFromFirestore(id)
  }

  async function addMediaBulk(mediaArray: Omit<MediaItem, 'id' | 'segmentIndex'>[]) {
    const newMedia = mediaArray.map(media => {
      const segmentIndex = assignSegmentIndex(media.timestamp)
      return {
        ...media,
        id: `media-${Date.now()}-${Math.random()}`,
        segmentIndex,
        comments: media.comments || []
      }
    })

    // Add to legacy store for backward compatibility
    allMedia.value.push(...newMedia)

    // Add lightweight markers
    const newMarkers = newMedia.map(m => ({
      id: m.id,
      segmentIndex: m.segmentIndex,
      type: m.type,
      thumbnail: m.thumbnail,
      timestamp: m.timestamp,
      location: m.location
    }))
    allMediaMarkers.value.push(...newMarkers)

    // Cache full details
    newMedia.forEach(m => loadedMediaDetails.value.set(m.id, m))

    // Save all media to Firestore
    await Promise.all(newMedia.map(media => saveMediaToFirestore(media)))

    return newMedia.length
  }

  function assignSegmentIndex(timestamp: string): number {
    const mediaTime = new Date(timestamp).getTime()

    // Find segment that contains this timestamp
    for (let i = 0; i < segments.value.length; i++) {
      const segment = segments.value[i]
      if (!segment) continue

      const segStart = new Date(segment.startTime).getTime()
      const segEnd = new Date(segment.endTime).getTime()

      if (mediaTime >= segStart && mediaTime <= segEnd) {
        return i
      }
    }

    // Find nearest segment if not contained
    let nearestIndex = 0
    let minDiff = Infinity

    segments.value.forEach((seg, index) => {
      const segStart = new Date(seg.startTime).getTime()
      const diff = Math.abs(mediaTime - segStart)
      if (diff < minDiff) {
        minDiff = diff
        nearestIndex = index
      }
    })

    return nearestIndex
  }

  function getMediaForSegment(segmentIndex: number): MediaItem[] {
    // First, get markers for this segment
    const markers = allMediaMarkers.value.filter(m => m.segmentIndex === segmentIndex)

    // Return full details if loaded, otherwise return minimal data from allMedia
    return markers.map(marker => {
      const fullDetails = loadedMediaDetails.value.get(marker.id)
      if (fullDetails) {
        return fullDetails
      }
      // Fallback to minimal data from allMedia
      const minimal = allMedia.value.find(m => m.id === marker.id)
      return minimal || {
        ...marker,
        url: marker.thumbnail || '',
        caption: undefined,
        exifData: undefined,
        comments: undefined
      }
    })
  }

  function getMediaUpToTimestamp(timestamp: number): MediaItem[] {
    return allMedia.value.filter(m => {
      const mediaTime = new Date(m.timestamp).getTime()
      return mediaTime <= timestamp
    })
  }

  async function addMediaComment(mediaId: string, comment: Omit<MediaComment, 'id' | 'timestamp'>) {
    const media = allMedia.value.find(m => m.id === mediaId)
    if (media) {
      if (!media.comments) {
        media.comments = []
      }
      const newComment: MediaComment = {
        ...comment,
        id: `comment-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString()
      }
      media.comments.push(newComment)
      await saveMediaToFirestore(media)
    }
  }

  async function removeMediaComment(mediaId: string, commentId: string) {
    const media = allMedia.value.find(m => m.id === mediaId)
    if (media && media.comments) {
      media.comments = media.comments.filter(c => c.id !== commentId)
      await saveMediaToFirestore(media)
    }
  }

  async function addComment(comment: Omit<Comment, 'id' | 'timestamp'>) {
    const newComment: Comment = {
      ...comment,
      id: `comment-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString()
    }
    allComments.value.push(newComment)
    await saveCommentToFirestore(newComment)
  }

  async function removeComment(id: string) {
    allComments.value = allComments.value.filter(c => c.id !== id)
    await deleteCommentFromFirestore(id)
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

  function triggerMediaView(mediaId: string) {
    // Set a unique timestamp to trigger reactivity even if same media clicked twice
    mediaToView.value = { mediaId, timestamp: Date.now() }
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

  // Firestore helpers
  async function saveMediaToFirestore(mediaItem: MediaItem) {
    try {
      const mediaRef = doc(db, 'media', mediaItem.id)

      // Clean the data - Firestore doesn't accept undefined values
      const cleanData: any = { ...mediaItem }

      // Convert undefined to null or omit fields
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === undefined) {
          delete cleanData[key]
        }
      })

      // Handle nested objects
      if (cleanData.exifData) {
        Object.keys(cleanData.exifData).forEach(key => {
          if (cleanData.exifData[key] === undefined) {
            delete cleanData.exifData[key]
          }
        })
      }

      await setDoc(mediaRef, cleanData)
      console.log('Media saved to Firestore:', mediaItem.id)
    } catch (e) {
      console.error('Failed to save media to Firestore:', e)
      throw e
    }
  }

  // Load only lightweight markers for map display
  async function loadMediaMarkersFromFirestore() {
    try {
      const mediaCollection = collection(db, 'media')
      const snapshot = await getDocs(mediaCollection)
      const markers: MediaMarker[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        // Extract only the fields needed for map markers
        markers.push({
          id: data.id,
          segmentIndex: data.segmentIndex,
          type: data.type,
          thumbnail: data.thumbnail,
          timestamp: data.timestamp,
          location: data.location
        })
      })

      allMediaMarkers.value = markers

      // Also populate allMedia with minimal data for backward compatibility
      // Components can check loadedMediaDetails for full info
      allMedia.value = markers.map(m => ({
        ...m,
        url: m.thumbnail || '',
        caption: undefined,
        exifData: undefined,
        comments: undefined
      }))

      console.log(`Loaded ${markers.length} media markers from Firestore`)
    } catch (e) {
      console.error('Failed to load media markers from Firestore:', e)
      // Fallback to localStorage if Firestore fails
      const stored = localStorage.getItem('roadtrip-media')
      if (stored) {
        try {
          const fullMedia = JSON.parse(stored)
          // Convert to markers
          allMediaMarkers.value = fullMedia.map((m: MediaItem) => ({
            id: m.id,
            segmentIndex: m.segmentIndex,
            type: m.type,
            thumbnail: m.thumbnail,
            timestamp: m.timestamp,
            location: m.location
          }))
          console.log('Loaded media markers from localStorage fallback')
        } catch (err) {
          console.error('Failed to load media from localStorage:', err)
        }
      }
    }
  }

  // Load full details for a specific media item (lazy-loaded on demand)
  async function loadMediaDetails(mediaId: string): Promise<MediaItem | null> {
    // Check cache first
    if (loadedMediaDetails.value.has(mediaId)) {
      return loadedMediaDetails.value.get(mediaId)!
    }

    try {
      const mediaRef = doc(db, 'media', mediaId)
      const docSnap = await getDoc(mediaRef)

      if (docSnap.exists()) {
        const mediaItem = docSnap.data() as MediaItem
        // Cache it
        loadedMediaDetails.value.set(mediaId, mediaItem)
        console.log('Loaded media details:', mediaId)
        return mediaItem
      } else {
        console.error('Media not found:', mediaId)
        return null
      }
    } catch (e) {
      console.error('Failed to load media details:', e)
      return null
    }
  }

  // Preload media details around a specific timestamp (for timeline sidebar)
  async function preloadMediaAroundTime(timestamp: number, windowMs: number = 24 * 60 * 60 * 1000) {
    const startTime = timestamp - windowMs / 2
    const endTime = timestamp + windowMs / 2

    const relevantMarkers = allMediaMarkers.value.filter(marker => {
      const markerTime = new Date(marker.timestamp).getTime()
      return markerTime >= startTime && markerTime <= endTime
    })

    console.log(`Preloading ${relevantMarkers.length} media items around timeline position`)

    // Load in parallel
    const promises = relevantMarkers.map(marker => loadMediaDetails(marker.id))
    await Promise.all(promises)
  }

  async function deleteMediaFromFirestore(mediaId: string) {
    try {
      const mediaRef = doc(db, 'media', mediaId)
      await deleteDoc(mediaRef)
      console.log('Media deleted from Firestore:', mediaId)
    } catch (e) {
      console.error('Failed to delete media from Firestore:', e)
      throw e
    }
  }

  async function saveCommentToFirestore(comment: Comment) {
    try {
      const commentRef = doc(db, 'comments', comment.id)
      await setDoc(commentRef, comment)
      console.log('Comment saved to Firestore:', comment.id)
    } catch (e) {
      console.error('Failed to save comment to Firestore:', e)
      throw e
    }
  }

  async function loadCommentsFromFirestore() {
    try {
      const commentsCollection = collection(db, 'comments')
      const snapshot = await getDocs(commentsCollection)
      const commentsList: Comment[] = []

      snapshot.forEach((doc) => {
        commentsList.push(doc.data() as Comment)
      })

      allComments.value = commentsList
      console.log(`Loaded ${commentsList.length} comments from Firestore`)
    } catch (e) {
      console.error('Failed to load comments from Firestore:', e)
      // Fallback to localStorage if Firestore fails
      const stored = localStorage.getItem('roadtrip-comments')
      if (stored) {
        try {
          allComments.value = JSON.parse(stored)
          console.log('Loaded comments from localStorage fallback')
        } catch (err) {
          console.error('Failed to load comments from localStorage:', err)
        }
      }
    }
  }

  async function deleteCommentFromFirestore(commentId: string) {
    try {
      const commentRef = doc(db, 'comments', commentId)
      await deleteDoc(commentRef)
      console.log('Comment deleted from Firestore:', commentId)
    } catch (e) {
      console.error('Failed to delete comment from Firestore:', e)
      throw e
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
    allMediaMarkers,
    loadedMediaDetails,
    allComments,
    mediaToView,
    timelineTimestamp,
    isTimelineModeActive,
    destinations,
    viewMode,
    selectedDay,
    layerVisibility,
    mediaTypeFilters,

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
    addMediaBulk,
    getMediaForSegment,
    getMediaUpToTimestamp,
    addMediaComment,
    removeMediaComment,
    addComment,
    removeComment,
    selectSegment,
    setSearchQuery,
    setDateRange,
    openMediaGallery,
    closeMediaGallery,
    triggerMediaView,
    setTimelineTimestamp,
    activateTimelineMode,
    deactivateTimelineMode,
    setViewMode,
    setSelectedDay,
    nextDay,
    previousDay,
    toggleLayer,
    setLayerVisibility,
    loadMediaMarkersFromFirestore,
    loadMediaDetails,
    preloadMediaAroundTime,
  }
})
