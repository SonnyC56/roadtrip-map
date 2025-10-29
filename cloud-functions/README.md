# Google Cloud Storage Setup Guide

Complete guide to set up Google Cloud Storage with Cloud Functions for your Road Trip media uploads.

## 📋 Prerequisites

Before you begin, make sure you have:

1. **Google Cloud Account**
   - Sign up at https://cloud.google.com
   - $300 free credit for new users

2. **Google Cloud SDK (gcloud)**
   - Install from: https://cloud.google.com/sdk/docs/install
   - Verify installation: `gcloud --version`

3. **Node.js 18+**
   - Install from: https://nodejs.org
   - Verify: `node --version`

## 🚀 Quick Start

### Option 1: Automated Deployment (Recommended)

```bash
# Navigate to cloud-functions directory
cd cloud-functions

# Set your project ID (replace with your GCP project ID)
export GCP_PROJECT_ID="your-project-id"

# Optional: customize bucket name and region
export GCS_BUCKET_NAME="roadtrip-media"
export GCP_REGION="us-central1"

# Run deployment script
./deploy.sh
```

The script will:
- ✅ Create the GCS bucket
- ✅ Configure CORS settings
- ✅ Set public read permissions
- ✅ Deploy the Cloud Function
- ✅ Output the endpoint URL

### Option 2: Manual Deployment

If you prefer manual control, follow these steps:

#### 1. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

#### 2. Enable Required APIs

```bash
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable storage.googleapis.com
```

#### 3. Create the Storage Bucket

```bash
# Create bucket
gsutil mb -p YOUR_PROJECT_ID -l us-central1 gs://roadtrip-media

# Apply CORS configuration
gsutil cors set cors.json gs://roadtrip-media

# Make bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://roadtrip-media
```

#### 4. Deploy the Cloud Function

```bash
cd upload-handler

# Install dependencies
npm install

# Deploy function
gcloud functions deploy uploadMedia \
  --gen2 \
  --runtime nodejs18 \
  --region us-central1 \
  --source . \
  --entry-point uploadMedia \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET_NAME=roadtrip-media \
  --max-instances 10 \
  --memory 256MB \
  --timeout 300s
```

#### 5. Get the Function URL

```bash
gcloud functions describe uploadMedia \
  --region us-central1 \
  --gen2 \
  --format='value(serviceConfig.uri)'
```

## ⚙️ Configure Your App

After deployment, configure your Road Trip app:

1. **Open your app** in the browser
2. **Click the Settings gear icon** ⚙️ (top right)
3. **Expand "Cloud Storage"** section
4. **Select Provider**: Choose "Google Cloud Storage"
5. **Enter Bucket Name**: `roadtrip-media` (or your custom name)
6. **Enter Endpoint URL**: Paste the function URL from deployment
7. **Click "Save"**
8. **Click "Test"** to verify the connection

✅ You should see "Connection successful!"

## 📸 Test Upload

1. Click **"Add Media"** from Settings
2. Select **"Upload File"** tab
3. Choose a photo or video
4. Fill in the form (metadata will auto-extract from EXIF)
5. Click **"Add Media"**

Watch the progress bar - your file is uploading to Google Cloud Storage! 🎉

## 🔒 Security Considerations

### For Production

The default deployment allows **unauthenticated** access. For production, consider:

#### 1. Restrict CORS Origins

Edit `cors.json`:
```json
[
  {
    "origin": ["https://yourdomain.com"],
    "method": ["GET", "HEAD", "PUT", "POST"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

Apply:
```bash
gsutil cors set cors.json gs://roadtrip-media
```

#### 2. Add Authentication

Update Cloud Function to require authentication:

```bash
gcloud functions deploy uploadMedia \
  --no-allow-unauthenticated \
  # ... other flags
```

Add authentication token to your app requests.

#### 3. Add File Validation

The function already validates:
- ✅ File types (images and videos only)
- ✅ File size (max 100MB)
- ✅ Content type verification

Customize in `index.js`:
```javascript
const MAX_FILE_SIZE = 100 * 1024 * 1024; // Adjust size
const ALLOWED_CONTENT_TYPES = [...]; // Add/remove types
```

#### 4. Rate Limiting

Add rate limiting to prevent abuse:

```bash
gcloud functions deploy uploadMedia \
  --max-instances 10 \  # Limit concurrent instances
  --ingress-settings internal-and-gclb \  # Restrict ingress
  # ... other flags
```

## 💰 Cost Estimation

### Free Tier (per month)
- **Cloud Functions**: 2M invocations free
- **Cloud Storage**: 5GB storage free
- **Bandwidth**: 1GB egress free (to internet)

### After Free Tier
- **Cloud Functions**: ~$0.40 per million invocations
- **Storage**: $0.020 per GB/month (Standard storage)
- **Egress**: $0.12 per GB (after free tier)

**Example for 1000 photos:**
- Storage: ~5GB = $0.10/month
- Uploads: 1000 invocations = $0.0004
- Views: ~10GB egress = ~$1.08

**Total: ~$1.18/month for 1000 photos**

## 🧪 Local Testing

Test the function locally before deploying:

```bash
cd upload-handler

# Install dependencies
npm install

# Install Functions Framework
npm install -g @google-cloud/functions-framework

# Set environment variable
export GCS_BUCKET_NAME=roadtrip-media

# Run locally
functions-framework --target=uploadMedia --port=8080
```

Test with curl:
```bash
curl -X POST http://localhost:8080 \
  -F "file=@/path/to/test-image.jpg" \
  -F "filename=media/test-image.jpg"
```

## 🔧 Troubleshooting

### "Permission Denied" Error

```bash
# Ensure you're authenticated
gcloud auth application-default login

# Check permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID
```

### "Bucket Not Found" Error

```bash
# Verify bucket exists
gsutil ls

# Create if missing
gsutil mb -p YOUR_PROJECT_ID gs://roadtrip-media
```

### "CORS Error" in Browser

```bash
# Re-apply CORS configuration
gsutil cors set cors.json gs://roadtrip-media

# Verify CORS is set
gsutil cors get gs://roadtrip-media
```

### "Function Not Deployed" Error

```bash
# Check deployment status
gcloud functions describe uploadMedia --region us-central1 --gen2

# View logs
gcloud functions logs read uploadMedia --region us-central1 --gen2 --limit 50
```

### Upload Fails with 500 Error

```bash
# Check Cloud Function logs
gcloud functions logs read uploadMedia --region us-central1 --gen2

# Common causes:
# - Bucket name mismatch (check GCS_BUCKET_NAME env var)
# - Missing permissions (ensure function has Storage Admin role)
# - File too large (increase timeout or reduce MAX_FILE_SIZE)
```

## 📊 Monitoring

### View Metrics

```bash
# Function invocations
gcloud functions describe uploadMedia \
  --region us-central1 --gen2 \
  --format='value(serviceConfig.invocations)'

# View logs in real-time
gcloud functions logs read uploadMedia \
  --region us-central1 --gen2 \
  --tail
```

### Cloud Console

Visit: https://console.cloud.google.com

- **Storage Browser**: View uploaded files
- **Cloud Functions**: Monitor performance
- **Logs Explorer**: Debug issues

## 🔄 Updates

To update the function after making changes:

```bash
cd upload-handler

# Redeploy
gcloud functions deploy uploadMedia \
  --gen2 \
  --runtime nodejs18 \
  --region us-central1 \
  --source . \
  --entry-point uploadMedia \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars GCS_BUCKET_NAME=roadtrip-media
```

## 🗑️ Cleanup

To remove all resources:

```bash
# Delete Cloud Function
gcloud functions delete uploadMedia --region us-central1 --gen2

# Delete bucket (WARNING: This deletes all files!)
gsutil rm -r gs://roadtrip-media
```

## 📚 Additional Resources

- [Cloud Functions Documentation](https://cloud.google.com/functions/docs)
- [Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
- [Best Practices](https://cloud.google.com/storage/docs/best-practices)

## 🆘 Need Help?

- **GCP Support**: https://cloud.google.com/support
- **Community**: https://stackoverflow.com/questions/tagged/google-cloud-storage
- **Issues**: Create an issue in your repository

---

**Happy uploading! 📸🚀**
