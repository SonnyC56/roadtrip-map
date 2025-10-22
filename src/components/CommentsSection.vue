<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoadTripStore } from '../stores/roadtrip'
import { ChatBubbleLeftIcon, TrashIcon, StarIcon } from '@heroicons/vue/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid'
import { format } from 'date-fns'

const store = useRoadTripStore()

const comments = computed(() => store.segmentComments)

const showAddComment = ref(false)
const newCommentAuthor = ref('')
const newCommentText = ref('')
const newCommentRating = ref(0)

function addComment() {
  if (!newCommentText.value || !newCommentAuthor.value || store.selectedSegmentIndex === null) return

  store.addComment({
    segmentIndex: store.selectedSegmentIndex,
    author: newCommentAuthor.value,
    text: newCommentText.value,
    rating: newCommentRating.value || undefined,
  })

  // Reset form
  newCommentText.value = ''
  newCommentAuthor.value = ''
  newCommentRating.value = 0
  showAddComment.value = false
}

function deleteComment(id: string) {
  if (confirm('Are you sure you want to delete this comment?')) {
    store.removeComment(id)
  }
}

function formatDate(dateString: string) {
  return format(new Date(dateString), 'MMM dd, yyyy \'at\' h:mm a')
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-gray-900 flex items-center gap-2">
        <ChatBubbleLeftIcon class="h-5 w-5" />
        Comments & Testimonials
      </h3>
      <button
        @click="showAddComment = !showAddComment"
        class="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        {{ showAddComment ? 'Cancel' : '+ Add' }}
      </button>
    </div>

    <!-- Add Comment Form -->
    <div
      v-if="showAddComment"
      class="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3 animate-fade-in"
    >
      <input
        v-model="newCommentAuthor"
        type="text"
        placeholder="Your name"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />

      <textarea
        v-model="newCommentText"
        rows="3"
        placeholder="Share your thoughts about this location..."
        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
      ></textarea>

      <!-- Rating -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Rating (Optional)
        </label>
        <div class="flex gap-1">
          <button
            v-for="star in 5"
            :key="star"
            @click="newCommentRating = star"
            class="focus:outline-none transition-transform hover:scale-110"
          >
            <StarIconSolid
              v-if="star <= newCommentRating"
              class="h-6 w-6 text-yellow-400"
            />
            <StarIcon
              v-else
              class="h-6 w-6 text-gray-300"
            />
          </button>
        </div>
      </div>

      <button
        @click="addComment"
        :disabled="!newCommentText || !newCommentAuthor"
        class="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Post Comment
      </button>
    </div>

    <!-- Comments List -->
    <div v-if="comments.length === 0" class="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
      <ChatBubbleLeftIcon class="h-12 w-12 text-gray-300 mx-auto mb-2" />
      <p class="text-gray-500">No comments yet</p>
      <p class="text-sm text-gray-400 mt-1">Be the first to share your experience!</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
      >
        <div class="flex items-start justify-between mb-2">
          <div>
            <p class="font-medium text-gray-900">{{ comment.author }}</p>
            <p class="text-xs text-gray-500">{{ formatDate(comment.timestamp) }}</p>
          </div>
          <button
            @click="deleteComment(comment.id)"
            class="p-1 hover:bg-red-50 rounded transition-colors"
          >
            <TrashIcon class="h-4 w-4 text-gray-400 hover:text-red-600" />
          </button>
        </div>

        <!-- Rating Stars -->
        <div v-if="comment.rating" class="flex gap-0.5 mb-2">
          <StarIconSolid
            v-for="star in comment.rating"
            :key="star"
            class="h-4 w-4 text-yellow-400"
          />
        </div>

        <p class="text-gray-700 text-sm leading-relaxed">{{ comment.text }}</p>
      </div>
    </div>
  </div>
</template>
