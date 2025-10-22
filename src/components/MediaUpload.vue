<script setup lang="ts">
import { ref } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import { PhotoIcon, VideoCameraIcon, GlobeAltIcon, XMarkIcon } from '@heroicons/vue/24/outline'

const store = useRoadTripStore()

const showUploadDialog = ref(false)
const mediaType = ref<'photo' | 'video' | '360-photo' | '360-video'>('photo')
const mediaUrl = ref('')
const mediaCaption = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function openUploadDialog() {
  showUploadDialog.value = true
}

function closeUploadDialog() {
  showUploadDialog.value = false
  mediaUrl.value = ''
  mediaCaption.value = ''
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    // In a real app, you'd upload to a server or cloud storage
    // For now, we'll use a local URL
    const url = URL.createObjectURL(file)
    mediaUrl.value = url
  }
}

function addMedia() {
  if (!mediaUrl.value || store.selectedSegmentIndex === null) return

  store.addMedia({
    segmentIndex: store.selectedSegmentIndex,
    type: mediaType.value,
    url: mediaUrl.value,
    caption: mediaCaption.value,
    timestamp: new Date().toISOString(),
  })

  closeUploadDialog()
}
</script>

<template>
  <div>
    <!-- Upload Button -->
    <button
      @click="openUploadDialog"
      class="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      <PhotoIcon class="h-5 w-5" />
      Add Media
    </button>

    <!-- Upload Dialog -->
    <Teleport to="body">
      <div
        v-if="showUploadDialog"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="closeUploadDialog"
      >
        <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-fade-in">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-gray-900">Add Media</h2>
            <button
              @click="closeUploadDialog"
              class="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon class="h-6 w-6 text-gray-500" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- Media Type Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Media Type
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  @click="mediaType = 'photo'"
                  :class="[
                    'p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1',
                    mediaType === 'photo'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  ]"
                >
                  <PhotoIcon class="h-6 w-6" :class="mediaType === 'photo' ? 'text-primary-600' : 'text-gray-400'" />
                  <span class="text-sm font-medium">Photo</span>
                </button>
                <button
                  @click="mediaType = 'video'"
                  :class="[
                    'p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1',
                    mediaType === 'video'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  ]"
                >
                  <VideoCameraIcon class="h-6 w-6" :class="mediaType === 'video' ? 'text-primary-600' : 'text-gray-400'" />
                  <span class="text-sm font-medium">Video</span>
                </button>
                <button
                  @click="mediaType = '360-photo'"
                  :class="[
                    'p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1',
                    mediaType === '360-photo'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  ]"
                >
                  <GlobeAltIcon class="h-6 w-6" :class="mediaType === '360-photo' ? 'text-primary-600' : 'text-gray-400'" />
                  <span class="text-sm font-medium">360° Photo</span>
                </button>
                <button
                  @click="mediaType = '360-video'"
                  :class="[
                    'p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1',
                    mediaType === '360-video'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  ]"
                >
                  <GlobeAltIcon class="h-6 w-6" :class="mediaType === '360-video' ? 'text-primary-600' : 'text-gray-400'" />
                  <span class="text-sm font-medium">360° Video</span>
                </button>
              </div>
            </div>

            <!-- File Upload -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Upload File
              </label>
              <input
                ref="fileInput"
                type="file"
                @change="handleFileSelect"
                :accept="mediaType.includes('video') ? 'video/*' : 'image/*'"
                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              <p class="mt-1 text-xs text-gray-500">
                Or enter a URL below
              </p>
            </div>

            <!-- URL Input -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Media URL
              </label>
              <input
                v-model="mediaUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <!-- Caption -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Caption (Optional)
              </label>
              <textarea
                v-model="mediaCaption"
                rows="3"
                placeholder="Add a caption for this media..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              ></textarea>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-2">
              <button
                @click="closeUploadDialog"
                class="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="addMedia"
                :disabled="!mediaUrl"
                class="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Media
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
