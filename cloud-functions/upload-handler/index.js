/**
 * Cloud Function for handling media uploads to Google Cloud Storage
 * Generates signed URLs and handles file uploads
 */

const { Storage } = require('@google-cloud/storage');
const Busboy = require('busboy');

// Initialize Storage client
const storage = new Storage();

// Configuration
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'roadtrip-media';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo'
];

/**
 * CORS headers for cross-origin requests
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // In production, replace with your domain
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '3600'
};

/**
 * Main Cloud Function entry point
 */
exports.uploadMedia = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.set(CORS_HEADERS);
    res.status(204).send('');
    return;
  }

  // Set CORS headers for main request
  res.set(CORS_HEADERS);

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { file, filename, contentType } = await parseMultipartForm(req);

    // Validate file
    if (!file || !filename) {
      res.status(400).json({ error: 'Missing file or filename' });
      return;
    }

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      res.status(400).json({
        error: 'Invalid file type',
        allowed: ALLOWED_CONTENT_TYPES
      });
      return;
    }

    // Validate file size
    if (file.length > MAX_FILE_SIZE) {
      res.status(400).json({
        error: 'File too large',
        maxSize: `${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
      return;
    }

    // Upload to GCS
    const bucket = storage.bucket(BUCKET_NAME);
    const blob = bucket.file(filename);

    // Upload the file
    await blob.save(file, {
      contentType: contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000', // 1 year
      }
    });

    // Make the file public
    await blob.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;

    console.log(`File uploaded successfully: ${filename}`);

    res.status(200).json({
      success: true,
      url: publicUrl,
      filename: filename,
      size: file.length,
      contentType: contentType
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
};

/**
 * Parse multipart form data
 */
function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_SIZE
      }
    });

    let fileData = null;
    let filename = null;
    let contentType = null;
    const fields = {};

    busboy.on('file', (fieldname, file, info) => {
      const { filename: fname, encoding, mimeType } = info;
      filename = fname;
      contentType = mimeType;

      const chunks = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        fileData = Buffer.concat(chunks);
      });
    });

    busboy.on('field', (fieldname, value) => {
      fields[fieldname] = value;

      // Allow filename override from form field
      if (fieldname === 'filename' && value) {
        filename = value;
      }
    });

    busboy.on('finish', () => {
      resolve({
        file: fileData,
        filename: filename,
        contentType: contentType,
        fields: fields
      });
    });

    busboy.on('error', (error) => {
      reject(error);
    });

    busboy.end(req.rawBody || req.body);
  });
}

/**
 * Alternative function for generating signed URLs
 * Allows client-side direct upload to GCS
 */
exports.getSignedUrl = async (req, res) => {
  // Handle CORS
  res.set(CORS_HEADERS);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      res.status(400).json({ error: 'Missing filename or contentType' });
      return;
    }

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      res.status(400).json({
        error: 'Invalid content type',
        allowed: ALLOWED_CONTENT_TYPES
      });
      return;
    }

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(filename);

    // Generate signed URL valid for 15 minutes
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType,
    });

    // Also generate the public URL for after upload
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filename}`;

    res.status(200).json({
      success: true,
      signedUrl: signedUrl,
      publicUrl: publicUrl,
      filename: filename,
      expiresIn: '15 minutes'
    });

  } catch (error) {
    console.error('Signed URL error:', error);
    res.status(500).json({
      error: 'Failed to generate signed URL',
      message: error.message
    });
  }
};
