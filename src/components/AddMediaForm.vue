<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import exifr from 'exifr'
import MediaInfoFactory from 'mediainfo.js'
import { storageService, type UploadProgress } from '../services/storage'

const props = defineProps<{
  segmentIndex?: number | null
}>()

const emit = defineEmits<{
  close: []
  added: []
}>()

const store = useRoadTripStore()

const uploadMode = ref<'file' | 'url'>('file')
const selectedFile = ref<File | null>(null)
const selectedFiles = ref<File[]>([])
const url = ref('')
const thumbnailUrl = ref('')
const thumbnailDataUrl = ref('')
const type = ref<'photo' | 'video' | '360-photo' | '360-video'>('photo')
const caption = ref('')
const timestamp = ref('')
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const inferLocation = ref(false)
const camera = ref('')
const focalLength = ref('')
const iso = ref('')
const exposureTime = ref('')
const errorMessage = ref<string | null>(null)
const isSubmitting = ref(false)
const isProcessing = ref(false)
const uploadProgress = ref<number>(0)
const uploadStatus = ref<string>('')
const fileInput = ref<HTMLInputElement | null>(null)

// Get current date/time as default
const now = new Date()
const defaultTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
timestamp.value = defaultTimestamp

const hasLocation = computed(() => lat.value !== null && lng.value !== null)
const canSubmit = computed(() => {
  const hasMedia = uploadMode.value === 'file' ? selectedFiles.value.length > 0 : url.value.trim() !== ''
  return hasMedia && type.value && timestamp.value && (inferLocation.value || hasLocation.value)
})

function handleInferLocationChange() {
  if (inferLocation.value) {
    lat.value = null
    lng.value = null
  }
}

function triggerFileSelect() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files

  if (!files || files.length === 0) return

  // Store all selected files
  selectedFiles.value = Array.from(files).filter(file => {
    const fileType = file.type.toLowerCase()
    return fileType.startsWith('image/') || fileType.startsWith('video/')
  })

  if (selectedFiles.value.length === 0) {
    errorMessage.value = 'No valid image or video files selected'
    return
  }

  // Process the first file for preview and metadata extraction
  const firstFile = selectedFiles.value[0]
  if (!firstFile) return

  selectedFile.value = firstFile
  errorMessage.value = null
  isProcessing.value = true

  try {
    // Detect media type from first file
    const fileType = firstFile.type.toLowerCase()
    if (fileType.startsWith('image/')) {
      type.value = 'photo'
    } else if (fileType.startsWith('video/')) {
      type.value = 'video'
    }

    // Generate preview/thumbnail and extract EXIF for images only
    if (fileType.startsWith('image/')) {
      await generateThumbnail(firstFile)
      await extractMetadata(firstFile)
    }

    // For videos, extract metadata and generate thumbnail
    if (fileType.startsWith('video/')) {
      await generateVideoThumbnail(firstFile)
      await extractVideoMetadata(firstFile)
    }

  } catch (error) {
    console.error('Error processing file:', error)
    errorMessage.value = 'Failed to process file metadata'
  } finally {
    isProcessing.value = false
  }
}

async function generateThumbnail(file: File) {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas for thumbnail
        const canvas = document.createElement('canvas')
        const maxSize = 200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        thumbnailDataUrl.value = canvas.toDataURL('image/jpeg', 0.8)
        resolve()
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function generateVideoThumbnail(file: File) {
  return new Promise<void>((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% into the video, whichever is shorter
      const seekTime = Math.min(1, video.duration * 0.1)
      video.currentTime = seekTime
    }

    video.onseeked = () => {
      try {
        const maxSize = 200
        let width = video.videoWidth
        let height = video.videoHeight

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(video, 0, 0, width, height)

        thumbnailDataUrl.value = canvas.toDataURL('image/jpeg', 0.8)
        console.log('✓ Video thumbnail generated')

        // Clean up
        URL.revokeObjectURL(video.src)
        resolve()
      } catch (error) {
        reject(error)
      }
    }

    video.onerror = (error) => {
      URL.revokeObjectURL(video.src)
      reject(error)
    }

    // Load the video
    video.src = URL.createObjectURL(file)
  })
}

async function extractMetadata(file: File) {
  try {
    const exif = await exifr.parse(file, true)

    if (!exif) {
      console.log('No EXIF data found')
      return
    }

    // Extract timestamp
    if (exif.DateTimeOriginal || exif.DateTime || exif.CreateDate) {
      const date = exif.DateTimeOriginal || exif.DateTime || exif.CreateDate
      const dateObj = new Date(date)
      if (!isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear()
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const day = String(dateObj.getDate()).padStart(2, '0')
        const hours = String(dateObj.getHours()).padStart(2, '0')
        const minutes = String(dateObj.getMinutes()).padStart(2, '0')
        timestamp.value = `${year}-${month}-${day}T${hours}:${minutes}`
      }
    }

    // Extract GPS location
    if (exif.latitude && exif.longitude) {
      lat.value = exif.latitude
      lng.value = exif.longitude
      inferLocation.value = false
    }

    // Extract camera info
    if (exif.Make || exif.Model) {
      camera.value = [exif.Make, exif.Model].filter(Boolean).join(' ')
    }

    if (exif.FocalLength) {
      focalLength.value = `${exif.FocalLength}mm`
    }

    if (exif.ISO) {
      iso.value = String(exif.ISO)
    }

    if (exif.ExposureTime) {
      exposureTime.value = exif.ExposureTime < 1
        ? `1/${Math.round(1 / exif.ExposureTime)}`
        : `${exif.ExposureTime}s`
    }

    console.log('Extracted EXIF data:', exif)
  } catch (error) {
    console.error('Failed to extract EXIF:', error)
    // Don't show error to user, just log it
  }
}

async function extractVideoMetadata(file: File) {
  try {
    console.log('🔍 Attempting to extract video metadata using MediaInfo...')
    let metadataFound = false

    try {
      // Use MediaInfo.js to parse video metadata
      const mediainfo = await MediaInfoFactory({
        locateFile: (path: string) => {
          // Use WASM files from public directory
          return `/mediainfo/${path}`
        }
      })

      const getSize = () => file.size
      const readChunk = (chunkSize: number, offset: number) =>
        new Promise<Uint8Array>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (event: ProgressEvent<FileReader>) => {
            if (event.target?.error) {
              reject(event.target.error)
            }
            resolve(new Uint8Array(event.target?.result as ArrayBuffer))
          }
          reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize))
        })

      const result = await mediainfo.analyzeData(getSize, readChunk)
      console.log('📦 MediaInfo result:', result)

      if (result?.media?.track) {
        const tracks = result.media.track

        // Look through all tracks for GPS and timestamp data
        for (const track of tracks) {
          const trackData = track as any // Cast to any to access dynamic properties
          console.log(`📊 Track type: ${trackData['@type']}`, trackData)

          // Look for GPS coordinates (common in QuickTime/MOV files)
          // Check various GPS field formats
          const gpsKeys = Object.keys(trackData).filter(key =>
            key.toLowerCase().includes('gps') ||
            key.toLowerCase().includes('location') ||
            key.toLowerCase().includes('coordinate')
          )

          if (gpsKeys.length > 0) {
            console.log('🌍 Found GPS-related fields:', gpsKeys)
            gpsKeys.forEach(key => console.log(`  ${key}: ${trackData[key]}`))

            // Try to parse any GPS field found
            for (const key of gpsKeys) {
              const value = trackData[key]
              if (typeof value === 'string') {
                // Parse "35.7985°N 121.3479°W" format
                const coordMatch = value.match(/([\d.]+)°([NS])\s+([\d.]+)°([EW])/)
                if (coordMatch && coordMatch[1] && coordMatch[2] && coordMatch[3] && coordMatch[4]) {
                  const latValue = parseFloat(coordMatch[1])
                  const latDir = coordMatch[2]
                  const lngValue = parseFloat(coordMatch[3])
                  const lngDir = coordMatch[4]

                  lat.value = latDir === 'S' ? -latValue : latValue
                  lng.value = lngDir === 'W' ? -lngValue : lngValue
                  inferLocation.value = false
                  metadataFound = true
                  console.log('✓ GPS extracted from video (Recorded_Location):', lat.value, lng.value)
                  break
                }
              }
            }
          }

          // If not found in GPS keys, try specific known fields
          if (!metadataFound) {
            // iPhone/Android videos often store GPS in xyz_gps_longitude/latitude
            if (trackData.xyz_gps_latitude && trackData.xyz_gps_longitude) {
              lat.value = parseFloat(trackData.xyz_gps_latitude)
              lng.value = parseFloat(trackData.xyz_gps_longitude)
              inferLocation.value = false
              metadataFound = true
              console.log('✓ GPS extracted from video (xyz_gps):', lat.value, lng.value)
            }
            // Try com.apple.quicktime.location.ISO6709
            else if (trackData['com.apple.quicktime.location.ISO6709']) {
              const iso6709 = trackData['com.apple.quicktime.location.ISO6709']
              console.log('Found ISO6709 location:', iso6709)
              // Parse ISO 6709 format: ±DD.DDDD±DDD.DDDD/
              const match = iso6709.match(/([+-]\d+\.\d+)([+-]\d+\.\d+)/)
              if (match) {
                lat.value = parseFloat(match[1])
                lng.value = parseFloat(match[2])
                inferLocation.value = false
                metadataFound = true
                console.log('✓ GPS extracted from video (ISO6709):', lat.value, lng.value)
              }
            }
          }

          // Look for timestamp
          const dateFields = ['Encoded_Date', 'Tagged_Date', 'Recorded_Date', 'File_Modified_Date']
          for (const field of dateFields) {
            if (trackData[field]) {
              console.log(`Found date field: ${field} = ${trackData[field]}`)
              const dateStr = trackData[field]
              // Parse UTC format like "UTC 2024-06-15 14:30:00"
              const dateObj = new Date(dateStr.replace('UTC ', ''))
              if (!isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear()
                const month = String(dateObj.getMonth() + 1).padStart(2, '0')
                const day = String(dateObj.getDate()).padStart(2, '0')
                const hours = String(dateObj.getHours()).padStart(2, '0')
                const minutes = String(dateObj.getMinutes()).padStart(2, '0')
                timestamp.value = `${year}-${month}-${day}T${hours}:${minutes}`
                metadataFound = true
                console.log('✓ Timestamp extracted from video metadata')
                break
              }
            }
          }
        }
      }

      mediainfo.close()
    } catch (mediaInfoError) {
      console.log('⚠️ MediaInfo extraction failed:', mediaInfoError)
    }

    // Fallback: Use file modification time
    if (!timestamp.value) {
      const fileDate = new Date(file.lastModified)
      const year = fileDate.getFullYear()
      const month = String(fileDate.getMonth() + 1).padStart(2, '0')
      const day = String(fileDate.getDate()).padStart(2, '0')
      const hours = String(fileDate.getHours()).padStart(2, '0')
      const minutes = String(fileDate.getMinutes()).padStart(2, '0')
      timestamp.value = `${year}-${month}-${day}T${hours}:${minutes}`
      console.log('ℹ Using file modification time for video timestamp')
    }

    // If no GPS found, suggest using "Infer Location"
    if (!lat.value && !lng.value) {
      console.log('💡 Tip: No GPS data in video - check "Infer Location from timestamp" or enter coordinates manually')
      inferLocation.value = true // Auto-enable infer location for videos without GPS
    }
  } catch (error) {
    console.error('Failed to extract video metadata:', error)
  }
}

async function addMedia() {
  errorMessage.value = null
  uploadProgress.value = 0
  uploadStatus.value = ''

  if (!canSubmit.value) {
    errorMessage.value = 'Please fill in all required fields'
    return
  }

  isSubmitting.value = true

  try {
    if (uploadMode.value === 'file' && selectedFiles.value.length > 0) {
      // Handle multiple file uploads
      const mediaItems: any[] = []
      const totalFiles = selectedFiles.value.length

      uploadStatus.value = `Processing ${totalFiles} file(s)...`

      for (let i = 0; i < selectedFiles.value.length; i++) {
        const file = selectedFiles.value[i]
        if (!file) continue

        const fileType = file.type.toLowerCase()

        uploadStatus.value = `Uploading file ${i + 1} of ${totalFiles}: ${file.name}`

        // Generate thumbnail for this file
        let fileThumbnailDataUrl = ''
        if (fileType.startsWith('image/')) {
          fileThumbnailDataUrl = await generateThumbnailForFile(file)
        } else if (fileType.startsWith('video/')) {
          fileThumbnailDataUrl = await generateVideoThumbnailForFile(file)
        }

        // Upload file to cloud storage
        const result = await storageService.uploadFile(
          file,
          fileThumbnailDataUrl,
          (progress: UploadProgress) => {
            const overallProgress = Math.floor(((i + progress.percentage / 100) / totalFiles) * 100)
            uploadProgress.value = overallProgress
            uploadStatus.value = `Uploading file ${i + 1} of ${totalFiles}: ${progress.percentage}%`
          }
        )

        if (!result.success) {
          throw new Error(result.error || `Upload failed for ${file.name}`)
        }

        // Extract metadata for each file
        let fileTimestamp = timestamp.value
        let fileLat = lat.value
        let fileLng = lng.value
        let fileCamera = camera.value
        let fileFocalLength = focalLength.value
        let fileIso = iso.value
        let fileExposureTime = exposureTime.value

        // Try to extract EXIF from each file
        if (fileType.startsWith('image/')) {
          try {
            const exif = await exifr.parse(file, true)
            if (exif) {
              // Extract timestamp
              if (exif.DateTimeOriginal || exif.DateTime || exif.CreateDate) {
                const date = exif.DateTimeOriginal || exif.DateTime || exif.CreateDate
                const dateObj = new Date(date)
                if (!isNaN(dateObj.getTime())) {
                  fileTimestamp = dateObj.toISOString().slice(0, 16)
                }
              }
              // Extract GPS
              if (exif.latitude && exif.longitude) {
                fileLat = exif.latitude
                fileLng = exif.longitude
              }
              // Extract camera info
              if (exif.Make || exif.Model) {
                fileCamera = [exif.Make, exif.Model].filter(Boolean).join(' ')
              }
              if (exif.FocalLength) {
                fileFocalLength = `${exif.FocalLength}mm`
              }
              if (exif.ISO) {
                fileIso = String(exif.ISO)
              }
              if (exif.ExposureTime) {
                fileExposureTime = exif.ExposureTime < 1
                  ? `1/${Math.round(1 / exif.ExposureTime)}`
                  : `${exif.ExposureTime}s`
              }
            }
          } catch (error) {
            console.error(`Failed to extract EXIF from ${file.name}:`, error)
          }
        }

        // Build media item
        const mediaItem: any = {
          url: result.url,
          type: fileType.startsWith('image/') ? type.value : 'video',
          timestamp: new Date(fileTimestamp).toISOString(),
        }

        // Add caption (same for all in batch, or use filename)
        if (caption.value.trim()) {
          mediaItem.caption = caption.value.trim()
        } else {
          // Use filename without extension as caption
          mediaItem.caption = file.name.replace(/\.[^/.]+$/, '')
        }

        if (result.thumbnailUrl) {
          mediaItem.thumbnail = result.thumbnailUrl
        }

        // Add location if provided or extracted
        if (!inferLocation.value && fileLat !== null && fileLng !== null) {
          mediaItem.location = {
            lat: fileLat,
            lng: fileLng,
            isInferred: false
          }
        }

        // Add EXIF data if available
        const exifData: any = {}
        if (fileCamera.trim()) exifData.camera = fileCamera.trim()
        if (fileFocalLength.trim()) exifData.focalLength = fileFocalLength.trim()
        if (fileIso.trim()) exifData.iso = fileIso.trim()
        if (fileExposureTime.trim()) exifData.exposureTime = fileExposureTime.trim()

        if (Object.keys(exifData).length > 0) {
          mediaItem.exifData = exifData
        }

        mediaItems.push(mediaItem)
      }

      // Add all media items to store using bulk import
      uploadStatus.value = 'Saving media...'
      await store.addMediaBulk(mediaItems)

      uploadStatus.value = `Complete! Uploaded ${totalFiles} file(s)`
      emit('added')
      emit('close')
    } else if (uploadMode.value === 'url') {
      // Handle single URL upload (existing logic)
      const finalUrl = url.value.trim()
      const finalThumbnail = thumbnailUrl.value.trim()

      const mediaItem: any = {
        url: finalUrl,
        type: type.value,
        timestamp: new Date(timestamp.value).toISOString(),
      }

      if (caption.value.trim()) {
        mediaItem.caption = caption.value.trim()
      }

      if (finalThumbnail) {
        mediaItem.thumbnail = finalThumbnail
      }

      if (!inferLocation.value && lat.value !== null && lng.value !== null) {
        mediaItem.location = {
          lat: lat.value,
          lng: lng.value,
          isInferred: false
        }
      }

      const exifData: any = {}
      if (camera.value.trim()) exifData.camera = camera.value.trim()
      if (focalLength.value.trim()) exifData.focalLength = focalLength.value.trim()
      if (iso.value.trim()) exifData.iso = iso.value.trim()
      if (exposureTime.value.trim()) exifData.exposureTime = exposureTime.value.trim()

      if (Object.keys(exifData).length > 0) {
        mediaItem.exifData = exifData
      }

      uploadStatus.value = 'Saving media...'
      store.addMedia(mediaItem)

      uploadStatus.value = 'Complete!'
      emit('added')
      emit('close')
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to add media'
    uploadStatus.value = ''
  } finally {
    isSubmitting.value = false
    uploadProgress.value = 0
  }
}

// Helper function to generate thumbnail for a file
async function generateThumbnailForFile(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxSize = 200
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Helper function to generate video thumbnail for a file
async function generateVideoThumbnailForFile(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      const seekTime = Math.min(1, video.duration * 0.1)
      video.currentTime = seekTime
    }

    video.onseeked = () => {
      try {
        const maxSize = 200
        let width = video.videoWidth
        let height = video.videoHeight

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(video, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        URL.revokeObjectURL(video.src)
        resolve(dataUrl)
      } catch (error) {
        reject(error)
      }
    }

    video.onerror = (error) => {
      URL.revokeObjectURL(video.src)
      reject(error)
    }

    video.src = URL.createObjectURL(file)
  })
}

function cancel() {
  emit('close')
}
</script>

<template>
  <div class="add-media-overlay" @click.self="cancel">
    <div class="add-media-modal">
      <div class="modal-header">
        <h3 class="modal-title">Add Media</h3>
        <button @click="cancel" class="btn-close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="addMedia" class="media-form">
          <!-- Upload Mode Toggle -->
          <div class="form-group">
            <div class="mode-toggle">
              <button
                type="button"
                @click="uploadMode = 'file'"
                class="mode-button"
                :class="{ active: uploadMode === 'file' }"
              >
                📤 Upload File
              </button>
              <button
                type="button"
                @click="uploadMode = 'url'"
                class="mode-button"
                :class="{ active: uploadMode === 'url' }"
              >
                🔗 Enter URL
              </button>
            </div>
          </div>

          <!-- File Upload Mode -->
          <div v-if="uploadMode === 'file'" class="form-group">
            <label class="form-label">Select Media Files *</label>
            <div class="file-upload-area">
              <input
                ref="fileInput"
                type="file"
                accept="image/*,video/*"
                multiple
                @change="handleFileSelect"
                class="file-input-hidden"
              />
              <button
                type="button"
                @click="triggerFileSelect"
                class="file-select-btn"
                :disabled="isProcessing"
              >
                <span v-if="selectedFiles.length === 0 && !isProcessing">Choose Files or Folder</span>
                <span v-else-if="isProcessing">Processing...</span>
                <span v-else-if="selectedFiles.length === 1">{{ selectedFiles[0]?.name }}</span>
                <span v-else>{{ selectedFiles.length }} files selected</span>
              </button>
              <div v-if="thumbnailDataUrl" class="thumbnail-preview">
                <img :src="thumbnailDataUrl" alt="Preview" />
              </div>
            </div>
            <div class="help-text">
              Select multiple files or a folder. Auto-extracts timestamp, location, and camera info from EXIF data. Tip: In the file picker, you can select a folder by clicking "Upload" when viewing a folder.
            </div>
          </div>

          <!-- URL Mode -->
          <template v-else>
            <div class="form-group">
              <label class="form-label">Media URL *</label>
              <input
                v-model="url"
                type="url"
                placeholder="https://storage.googleapis.com/.../photo.jpg"
                class="form-input"
                required
              />
            </div>

            <div class="form-group">
              <label class="form-label">Thumbnail URL (optional)</label>
              <input
                v-model="thumbnailUrl"
                type="url"
                placeholder="https://storage.googleapis.com/.../thumb.jpg"
                class="form-input"
              />
            </div>
          </template>

          <!-- Type -->
          <div class="form-group">
            <label class="form-label">Type *</label>
            <div class="type-buttons">
              <button
                type="button"
                @click="type = 'photo'"
                class="type-button"
                :class="{ active: type === 'photo' }"
              >
                📷 Photo
              </button>
              <button
                type="button"
                @click="type = 'video'"
                class="type-button"
                :class="{ active: type === 'video' }"
              >
                🎥 Video
              </button>
              <button
                type="button"
                @click="type = '360-photo'"
                class="type-button"
                :class="{ active: type === '360-photo' }"
              >
                🌐 360° Photo
              </button>
              <button
                type="button"
                @click="type = '360-video'"
                class="type-button"
                :class="{ active: type === '360-video' }"
              >
                🎬 360° Video
              </button>
            </div>
          </div>

          <!-- Caption -->
          <div class="form-group">
            <label class="form-label">Caption</label>
            <input
              v-model="caption"
              type="text"
              placeholder="Enter caption..."
              class="form-input"
            />
          </div>

          <!-- Timestamp -->
          <div class="form-group">
            <label class="form-label">Date & Time *</label>
            <input
              v-model="timestamp"
              type="datetime-local"
              class="form-input"
              required
            />
          </div>

          <!-- Location -->
          <div class="form-group">
            <div class="location-header">
              <label class="form-label">Location *</label>
              <label class="checkbox-label">
                <input
                  v-model="inferLocation"
                  type="checkbox"
                  @change="handleInferLocationChange"
                />
                <span>Infer from timestamp</span>
              </label>
            </div>

            <div v-if="!inferLocation" class="location-inputs">
              <input
                v-model.number="lat"
                type="number"
                step="any"
                placeholder="Latitude"
                class="form-input"
                required
              />
              <input
                v-model.number="lng"
                type="number"
                step="any"
                placeholder="Longitude"
                class="form-input"
                required
              />
            </div>
            <div v-else class="infer-note">
              Location will be inferred from the timestamp based on your trip timeline.
            </div>
          </div>

          <!-- EXIF Data (Optional) -->
          <details class="exif-details">
            <summary class="exif-summary">Camera Info (optional)</summary>
            <div class="exif-content">
              <div class="form-group-small">
                <label class="form-label-small">Camera</label>
                <input
                  v-model="camera"
                  type="text"
                  placeholder="e.g., iPhone 14 Pro"
                  class="form-input-small"
                />
              </div>
              <div class="form-group-small">
                <label class="form-label-small">Focal Length</label>
                <input
                  v-model="focalLength"
                  type="text"
                  placeholder="e.g., 24mm"
                  class="form-input-small"
                />
              </div>
              <div class="form-group-small">
                <label class="form-label-small">ISO</label>
                <input
                  v-model="iso"
                  type="text"
                  placeholder="e.g., 100"
                  class="form-input-small"
                />
              </div>
              <div class="form-group-small">
                <label class="form-label-small">Exposure Time</label>
                <input
                  v-model="exposureTime"
                  type="text"
                  placeholder="e.g., 1/250"
                  class="form-input-small"
                />
              </div>
            </div>
          </details>

          <!-- Upload Progress -->
          <div v-if="isSubmitting && uploadProgress > 0" class="upload-progress">
            <div class="progress-header">
              <span class="progress-label">{{ uploadStatus }}</span>
              <span class="progress-percentage">{{ uploadProgress }}%</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar" :style="{ width: `${uploadProgress}%` }"></div>
            </div>
          </div>

          <!-- Error message -->
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button type="button" @click="cancel" class="btn-cancel" :disabled="isSubmitting">
              Cancel
            </button>
            <button
              type="submit"
              class="btn-submit"
              :disabled="!canSubmit || isSubmitting"
            >
              {{ isSubmitting ? uploadStatus || 'Adding...' : 'Add Media' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-media-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2500;
  padding: 1rem;
}

.add-media-modal {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  cursor: pointer;
  color: white;
  padding: 0.25rem;
  border-radius: 6px;
  transition: background 0.2s;
}

.btn-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.media-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1f2937;
}

.mode-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  padding: 0.25rem;
  background: rgba(248, 250, 252, 0.8);
  border-radius: 8px;
}

.mode-button {
  padding: 0.625rem 1rem;
  border: 2px solid transparent;
  border-radius: 6px;
  background: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
}

.mode-button:hover {
  border-color: #3b82f6;
  color: #1f2937;
}

.mode-button.active {
  border-color: #3b82f6;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  color: #3b82f6;
}

.file-upload-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.file-input-hidden {
  display: none;
}

.file-select-btn {
  padding: 1rem;
  border: 2px dashed rgba(15, 23, 42, 0.2);
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.5);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: #1f2937;
  text-align: left;
}

.file-select-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.file-select-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.thumbnail-preview {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid rgba(59, 130, 246, 0.3);
}

.thumbnail-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.help-text {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
  margin-top: -0.25rem;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  transition: border-color 0.2s;
  color: #000000;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  color: #000000;
}

.type-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.type-button {
  padding: 0.75rem;
  border: 2px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  background: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.type-button:hover {
  border-color: #3b82f6;
}

.type-button.active {
  border-color: #3b82f6;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
}

.location-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.location-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.infer-note {
  padding: 0.75rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #1f2937;
  line-height: 1.5;
}

.exif-details {
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 8px;
  padding: 1rem;
  background: rgba(248, 250, 252, 0.5);
}

.exif-summary {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1f2937;
  cursor: pointer;
  user-select: none;
}

.exif-content {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-group-small {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label-small {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.form-input-small {
  padding: 0.5rem;
  border: 1px solid rgba(15, 23, 42, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: inherit;
  color: #000000;
  background: white;
}

.form-input-small:focus {
  outline: none;
  border-color: #3b82f6;
  color: #000000;
}

.upload-progress {
  padding: 1rem;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.progress-percentage {
  font-size: 0.875rem;
  font-weight: 700;
  color: #3b82f6;
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.error-message {
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.875rem;
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.btn-cancel,
.btn-submit {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: rgba(15, 23, 42, 0.05);
  color: #64748b;
}

.btn-cancel:hover {
  background: rgba(15, 23, 42, 0.1);
}

.btn-submit {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-submit:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

@media (max-width: 640px) {
  .add-media-modal {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .type-buttons {
    grid-template-columns: 1fr;
  }

  .exif-content {
    grid-template-columns: 1fr;
  }
}
</style>
