<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoadTripStore, type MediaComment } from '../stores/roadtrip'
import { format } from 'date-fns'

const props = defineProps<{
  mediaId: string
}>()

const store = useRoadTripStore()
const authorName = ref('')
const commentText = ref('')
const rating = ref<number | undefined>(undefined)
const isAddingComment = ref(false)

// Get comments for this media item
const media = computed(() =>
  store.allMedia.find(m => m.id === props.mediaId)
)

const comments = computed(() =>
  media.value?.comments || []
)

// Load author name from localStorage
onMounted(() => {
  const savedAuthor = localStorage.getItem('media-comment-author')
  if (savedAuthor) {
    authorName.value = savedAuthor
  }
})

function addComment() {
  if (!commentText.value.trim() || !authorName.value.trim()) return

  // Save author name to localStorage
  localStorage.setItem('media-comment-author', authorName.value)

  store.addMediaComment(props.mediaId, {
    author: authorName.value,
    text: commentText.value,
    rating: rating.value
  })

  // Reset form
  commentText.value = ''
  rating.value = undefined
  isAddingComment.value = false
}

function deleteComment(commentId: string) {
  if (confirm('Delete this comment?')) {
    store.removeMediaComment(props.mediaId, commentId)
  }
}

function formatDate(dateStr: string) {
  return format(new Date(dateStr), 'MMM dd, yyyy h:mm a')
}

function setRating(stars: number) {
  rating.value = stars
}
</script>

<template>
  <div class="media-comments">
    <div class="comments-header">
      <h4 class="comments-title">
        Comments
        <span v-if="comments.length > 0" class="comment-count">{{ comments.length }}</span>
      </h4>
      <button
        v-if="!isAddingComment"
        @click="isAddingComment = true"
        class="btn-add-comment"
      >
        + Add Comment
      </button>
    </div>

    <!-- Add Comment Form -->
    <div v-if="isAddingComment" class="add-comment-form">
      <input
        v-model="authorName"
        type="text"
        placeholder="Your name"
        class="input-author"
      />
      <textarea
        v-model="commentText"
        placeholder="Write a comment..."
        rows="3"
        class="input-comment"
      />

      <!-- Rating -->
      <div class="rating-input">
        <span class="rating-label">Rating (optional):</span>
        <div class="stars">
          <button
            v-for="star in 5"
            :key="star"
            @click="setRating(star)"
            class="star-btn"
            :class="{ active: rating && rating >= star }"
          >
            ★
          </button>
          <button
            v-if="rating"
            @click="rating = undefined"
            class="clear-rating"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="form-actions">
        <button @click="isAddingComment = false" class="btn-cancel">
          Cancel
        </button>
        <button
          @click="addComment"
          class="btn-submit"
          :disabled="!commentText.trim() || !authorName.trim()"
        >
          Post Comment
        </button>
      </div>
    </div>

    <!-- Comments List -->
    <div v-if="comments.length > 0" class="comments-list">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-item"
      >
        <div class="comment-header">
          <div class="comment-author">{{ comment.author }}</div>
          <button @click="deleteComment(comment.id)" class="btn-delete" title="Delete">
            ✕
          </button>
        </div>

        <div v-if="comment.rating" class="comment-rating">
          <span v-for="star in 5" :key="star" class="star" :class="{ filled: star <= comment.rating }">
            ★
          </span>
        </div>

        <div class="comment-text">{{ comment.text }}</div>
        <div class="comment-date">{{ formatDate(comment.timestamp) }}</div>
      </div>
    </div>

    <div v-else-if="!isAddingComment" class="no-comments">
      No comments yet. Be the first to comment!
    </div>
  </div>
</template>

<style scoped>
.media-comments {
  padding: 1rem;
  background: rgba(248, 250, 252, 0.5);
  border-radius: 8px;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.comments-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.comment-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  min-width: 24px;
}

.btn-add-comment {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-comment:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.add-comment-form {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid rgba(15, 23, 42, 0.1);
}

.input-author,
.input-comment {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: inherit;
  margin-bottom: 0.75rem;
}

.input-author {
  font-weight: 600;
}

.input-comment {
  resize: vertical;
  min-height: 80px;
}

.rating-input {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.rating-label {
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

.stars {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.star-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s;
}

.star-btn:hover {
  color: #fbbf24;
  transform: scale(1.1);
}

.star-btn.active {
  color: #f59e0b;
}

.clear-rating {
  background: rgba(239, 68, 68, 0.1);
  border: none;
  color: #dc2626;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 0.5rem;
  transition: all 0.2s;
}

.clear-rating:hover {
  background: rgba(239, 68, 68, 0.2);
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn-cancel,
.btn-submit {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
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
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-submit:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.comment-item {
  background: white;
  padding: 0.875rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.1);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.comment-author {
  font-weight: 700;
  font-size: 0.875rem;
  color: #1f2937;
}

.btn-delete {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;
  transition: color 0.2s;
}

.btn-delete:hover {
  color: #dc2626;
}

.comment-rating {
  margin-bottom: 0.5rem;
}

.star {
  color: #cbd5e1;
  font-size: 1rem;
}

.star.filled {
  color: #f59e0b;
}

.comment-text {
  color: #475569;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-bottom: 0.5rem;
  white-space: pre-wrap;
}

.comment-date {
  font-size: 0.75rem;
  color: #94a3b8;
}

.no-comments {
  text-align: center;
  padding: 2rem 1rem;
  color: #94a3b8;
  font-size: 0.875rem;
}

@media (max-width: 640px) {
  .media-comments {
    padding: 0.75rem;
  }

  .btn-add-comment {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .star-btn {
    font-size: 1.25rem;
  }
}
</style>
