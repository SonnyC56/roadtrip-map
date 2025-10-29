/**
 * Storage Service
 * Handles file uploads to Firebase Storage
 */

import { storage } from '../config/firebase'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'

export interface UploadResult {
  url: string
  thumbnailUrl?: string
  success: boolean
  error?: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

class StorageService {
  /**
   * Upload file to Firebase Storage
   */
  async uploadFile(
    file: File,
    thumbnailDataUrl?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Generate unique filename with timestamp
      const timestamp = Date.now()
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filename = `${timestamp}-${sanitizedName}`

      // Upload main file
      const mediaRef = ref(storage, `media/${filename}`)
      const uploadTask = uploadBytesResumable(mediaRef, file)

      // Track upload progress
      uploadTask.on('state_changed',
        (snapshot) => {
          if (onProgress) {
            const progress = {
              loaded: snapshot.bytesTransferred,
              total: snapshot.totalBytes,
              percentage: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            }
            onProgress(progress)
          }
        }
      )

      // Wait for upload to complete
      await uploadTask

      // Get download URL
      const url = await getDownloadURL(mediaRef)

      // Upload thumbnail if provided
      let thumbnailUrl: string | undefined

      if (thumbnailDataUrl) {
        try {
          // Convert data URL to blob
          const response = await fetch(thumbnailDataUrl)
          const blob = await response.blob()

          const thumbnailFilename = `${timestamp}-${sanitizedName}.thumb.jpg`
          const thumbnailRef = ref(storage, `thumbnails/${thumbnailFilename}`)

          await uploadBytesResumable(thumbnailRef, blob)
          thumbnailUrl = await getDownloadURL(thumbnailRef)
        } catch (error) {
          console.error('Thumbnail upload failed:', error)
          // Continue without thumbnail
        }
      }

      return {
        url,
        thumbnailUrl: thumbnailUrl || url,
        success: true
      }

    } catch (error) {
      console.error('Upload failed:', error)
      return {
        url: '',
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Delete file from Firebase Storage
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract path from URL
      const url = new URL(fileUrl)
      const pathMatch = url.pathname.match(/\/o\/(.+)/)

      if (!pathMatch || !pathMatch[1]) {
        throw new Error('Invalid file URL')
      }

      const filePath = decodeURIComponent(pathMatch[1])
      const fileRef = ref(storage, filePath)

      await deleteObject(fileRef)
      console.log('File deleted:', filePath)
    } catch (error) {
      console.error('Delete failed:', error)
      throw error
    }
  }

  /**
   * Test Firebase Storage connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Create a tiny test file
      const testBlob = new Blob(['test'], { type: 'text/plain' })
      const testFile = new File([testBlob], 'test.txt', { type: 'text/plain' })

      const result = await this.uploadFile(testFile)

      if (result.success) {
        // Clean up test file
        try {
          await this.deleteFile(result.url)
        } catch (e) {
          // Ignore cleanup errors
        }
        return { success: true, message: 'Firebase Storage connection successful!' }
      } else {
        return { success: false, message: result.error || 'Connection test failed' }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  // Legacy methods for compatibility (no-op)
  configure() {
    console.warn('configure() is deprecated - Firebase Storage is configured via environment variables')
  }

  getConfig() {
    return { provider: 'firebase' as const }
  }

  loadConfigFromStorage() {
    // No-op for Firebase
  }
}

// Export singleton instance
export const storageService = new StorageService()
