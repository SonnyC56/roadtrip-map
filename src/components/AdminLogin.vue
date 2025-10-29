<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{
  close: []
}>()

const { signIn, signInWithGoogle } = useAuth()

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const isGoogleLoading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  if (!email.value || !password.value) {
    errorMessage.value = 'Please enter email and password'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  const result = await signIn(email.value, password.value)

  isLoading.value = false

  if (!result.success) {
    errorMessage.value = result.error || 'Failed to sign in'
  }
  // If success, the auth state will automatically update
}

async function handleGoogleLogin() {
  isGoogleLoading.value = true
  errorMessage.value = ''

  const result = await signInWithGoogle()

  isGoogleLoading.value = false

  if (!result.success) {
    errorMessage.value = result.error || 'Failed to sign in with Google'
  }
  // If success, the auth state will automatically update
}

function handleKeyPress(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    handleLogin()
  }
}
</script>

<template>
  <div class="login-container" @click.self="emit('close')">
    <div class="login-card">
      <div class="login-header">
        <div>
          <h2 class="login-title">Admin Login</h2>
          <p class="login-subtitle">Sign in to manage your road trip media</p>
        </div>
        <button @click="emit('close')" class="close-button" title="Close">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="login-form">
        <!-- Google Sign-In -->
        <button
          @click="handleGoogleLogin"
          class="google-button"
          :disabled="isGoogleLoading || isLoading"
        >
          <svg v-if="!isGoogleLoading" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" fill-rule="evenodd">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
              <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z" fill="#FBBC05"/>
              <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
            </g>
          </svg>
          <span v-else class="spinner-small">⏳</span>
          {{ isGoogleLoading ? 'Signing in...' : 'Continue with Google' }}
        </button>

        <!-- Divider -->
        <div class="divider">
          <span class="divider-text">or</span>
        </div>

        <!-- Email/Password Sign-In -->
        <div class="form-group">
          <label for="email" class="form-label">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-input"
            placeholder="admin@example.com"
            :disabled="isLoading || isGoogleLoading"
            @keypress="handleKeyPress"
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-input"
            placeholder="••••••••"
            :disabled="isLoading || isGoogleLoading"
            @keypress="handleKeyPress"
            autocomplete="current-password"
          />
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button
          @click="handleLogin"
          class="login-button"
          :disabled="isLoading || isGoogleLoading"
        >
          {{ isLoading ? 'Signing in...' : 'Sign In with Email' }}
        </button>

        <div class="help-text">
          Don't have an account? Create one in the <a href="https://console.firebase.google.com/project/interactive-roadtrip/authentication/users" target="_blank" rel="noopener">Firebase Console</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  z-index: 2000;
}

.login-card {
  width: 90%;
  max-width: 400px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.login-header {
  padding: 2rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.login-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.5rem;
}

.login-subtitle {
  font-size: 0.875rem;
  margin: 0;
  opacity: 0.95;
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.login-form {
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s ease;
  background: white;
  color: #1f2937;
}

.form-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}

.form-input:disabled {
  background: #f9fafb;
  cursor: not-allowed;
  opacity: 0.6;
}

.error-message {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #dc2626;
  font-size: 0.875rem;
  font-weight: 500;
}

.login-button {
  width: 100%;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 1rem;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);
}

.login-button:active:not(:disabled) {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.help-text {
  font-size: 0.75rem;
  color: #64748b;
  text-align: center;
  line-height: 1.5;
}

.help-text a {
  color: #f59e0b;
  text-decoration: none;
  font-weight: 600;
}

.help-text a:hover {
  text-decoration: underline;
}

.google-button {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 600;
  background: white;
  color: #1f2937;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.google-button:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.google-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-small {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
  text-align: center;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e5e7eb;
}

.divider-text {
  padding: 0 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@media (max-width: 640px) {
  .login-card {
    width: 95%;
    border-radius: 16px;
  }

  .login-header {
    padding: 1.5rem;
  }

  .login-title {
    font-size: 1.5rem;
  }

  .login-form {
    padding: 1.5rem;
  }
}
</style>
