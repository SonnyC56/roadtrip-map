#!/bin/bash

# Deployment script for Google Cloud Functions
# This script deploys the upload handler function to GCP

set -e

echo "🚀 Deploying Road Trip Media Upload Handler to Google Cloud Functions..."
echo ""

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-roadtrip-map}"
BUCKET_NAME="${GCS_BUCKET_NAME:-roadtrip-media}"
REGION="${GCP_REGION:-us-central1}"
FUNCTION_NAME="uploadMedia"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Bucket Name: $BUCKET_NAME"
echo "  Region: $REGION"
echo "  Function Name: $FUNCTION_NAME"
echo ""

# Confirm before proceeding
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

# Set the active project
echo -e "${YELLOW}📦 Setting active project...${NC}"
gcloud config set project $PROJECT_ID

# Create the bucket if it doesn't exist
echo -e "${YELLOW}🪣 Checking if bucket exists...${NC}"
if gsutil ls -b gs://$BUCKET_NAME &> /dev/null; then
    echo -e "${GREEN}✓ Bucket already exists${NC}"
else
    echo -e "${YELLOW}Creating bucket...${NC}"
    gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_NAME
    echo -e "${GREEN}✓ Bucket created${NC}"
fi

# Apply CORS configuration
echo -e "${YELLOW}🌐 Applying CORS configuration...${NC}"
gsutil cors set cors.json gs://$BUCKET_NAME
echo -e "${GREEN}✓ CORS configured${NC}"

# Make bucket publicly readable (optional, for public URLs)
echo -e "${YELLOW}🔓 Setting bucket permissions...${NC}"
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
echo -e "${GREEN}✓ Bucket is now public${NC}"

# Deploy the Cloud Function
echo -e "${YELLOW}☁️  Deploying Cloud Function...${NC}"
cd upload-handler
gcloud functions deploy $FUNCTION_NAME \
    --gen2 \
    --runtime nodejs18 \
    --region $REGION \
    --source . \
    --entry-point uploadMedia \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars GCS_BUCKET_NAME=$BUCKET_NAME \
    --max-instances 10 \
    --memory 256MB \
    --timeout 300s

cd ..

# Get the function URL
FUNCTION_URL=$(gcloud functions describe $FUNCTION_NAME --region $REGION --gen2 --format='value(serviceConfig.uri)')

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${YELLOW}📍 Function URL:${NC}"
echo "  $FUNCTION_URL"
echo ""
echo -e "${YELLOW}🔧 Next steps:${NC}"
echo "  1. Copy the function URL above"
echo "  2. Open your Road Trip app"
echo "  3. Click the Settings gear icon ⚙️"
echo "  4. Expand 'Cloud Storage' section"
echo "  5. Select 'Google Cloud Storage' as provider"
echo "  6. Enter bucket name: $BUCKET_NAME"
echo "  7. Enter endpoint URL: $FUNCTION_URL"
echo "  8. Click 'Save' and 'Test'"
echo ""
echo -e "${GREEN}Happy uploading! 📸${NC}"
