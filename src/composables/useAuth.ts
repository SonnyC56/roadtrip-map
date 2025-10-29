/**
 * Authentication Composable
 * Manages Firebase Authentication state and operations
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { auth } from '../config/firebase'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'

const currentUser = ref<User | null>(null)
const isAuthenticated = ref(false)
const isLoading = ref(true)

let unsubscribe: (() => void) | null = null

export function useAuth() {
  onMounted(() => {
    // Listen for auth state changes
    unsubscribe = onAuthStateChanged(auth, (user) => {
      currentUser.value = user
      isAuthenticated.value = !!user
      isLoading.value = false
    })
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  async function signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return { success: true, user: userCredential.user }
    } catch (error: any) {
      console.error('Sign in error:', error)
      let message = 'Failed to sign in'

      if (error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password'
      } else if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email'
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password'
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Try again later.'
      }

      return { success: false, error: message }
    }
  }

  async function signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      return { success: true, user: result.user }
    } catch (error: any) {
      console.error('Google sign in error:', error)
      let message = 'Failed to sign in with Google'

      if (error.code === 'auth/popup-closed-by-user') {
        message = 'Sign in cancelled'
      } else if (error.code === 'auth/popup-blocked') {
        message = 'Popup blocked. Please enable popups for this site.'
      } else if (error.code === 'auth/unauthorized-domain') {
        message = 'This domain is not authorized for Google sign-in'
      }

      return { success: false, error: message }
    }
  }

  async function signOut() {
    try {
      await firebaseSignOut(auth)
      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      return { success: false, error: 'Failed to sign out' }
    }
  }

  return {
    currentUser,
    isAuthenticated,
    isLoading,
    signIn,
    signInWithGoogle,
    signOut
  }
}
