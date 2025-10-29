# Firebase Setup Guide
## Interactive Road Trip - Authentication, Storage & Database

This guide will help you set up Firebase Authentication, Storage, and Firestore Database so **only you** can upload media and your data persists across devices.

---

## 📋 Step 1: Get Your Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/project/interactive-roadtrip/settings/general)

2. Scroll down to "Your apps" section

3. If you don't have a web app yet:
   - Click **"Add app"** → Select **Web** (</> icon)
   - Nickname: `Interactive Road Trip`
   - Click **"Register app"**

4. Copy the Firebase config values shown

5. Create `.env.local` file in the project root:
   ```bash
   cp .env.example .env.local
   ```

6. Fill in your Firebase config in `.env.local`:
   ```env
   VITE_FIREBASE_API_KEY=AIza... (your actual key)
   VITE_FIREBASE_AUTH_DOMAIN=interactive-roadtrip.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=interactive-roadtrip
   VITE_FIREBASE_STORAGE_BUCKET=interactive-roadtrip.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

---

## 🔐 Step 2: Enable Firebase Authentication

1. Go to [Firebase Console - Authentication](https://console.firebase.google.com/project/interactive-roadtrip/authentication)

2. Click **"Get started"** (if first time)

3. Click on **"Sign-in method"** tab

### Enable Email/Password Authentication

4. Click **"Email/Password"** provider

5. Toggle **Enable** to ON

6. Click **"Save"**

### Enable Google Authentication

7. Click **"Google"** provider

8. Toggle **Enable** to ON

9. Enter a **Project support email** (your email address)

10. Click **"Save"**

---

## 👤 Step 3: Create Your Admin Account

1. Stay in [Firebase Console - Authentication](https://console.firebase.google.com/project/interactive-roadtrip/authentication/users)

2. Click on **"Users"** tab

3. Click **"Add user"**

4. Enter your email and password (this will be your admin login)

5. Click **"Add user"**

6. **IMPORTANT:** Copy the **User UID** from the users list (you'll need this in the next step)

   Example UID: `abc123xyz789def456ghi`

---

## 🔒 Step 4: Update Storage Rules with Your UID

1. Open `storage.rules` in your project

2. Replace **all** instances of `YOUR_USER_ID` with your actual UID:

   ```javascript
   // Before:
   allow create, update: if request.auth.uid == 'YOUR_USER_ID'

   // After (example):
   allow create, update: if request.auth.uid == 'abc123xyz789'
   ```

3. Save the file

---

## 🚀 Step 5: Deploy Storage Rules

Deploy the security rules to Firebase:

```bash
# Make sure you're in the project directory
cd /Users/sonnycirasuolo/interactiveRoadtrip/roadtrip-map

# Deploy storage rules
firebase deploy --only storage
```

You should see:
```
✔  Deploy complete!
```

---

## 🗄️ Step 6: Enable Firestore Database

Firestore stores your media metadata (URLs, captions, timestamps) so data persists across browsers and devices.

1. Go to [Firebase Console - Firestore](https://console.firebase.google.com/project/interactive-roadtrip/firestore)

2. Click **"Create database"**

3. **Choose a mode:**
   - Select **"Start in production mode"** (we already have security rules)
   - Click **"Next"**

4. **Select a location:**
   - Choose a location close to you (e.g., `us-central1`)
   - Click **"Enable"**

5. **Deploy Firestore Rules:**
   ```bash
   firebase deploy --only firestore
   ```

   You should see:
   ```
   ✔  firestore: released rules firestore.rules to cloud.firestore
   ✔  Deploy complete!
   ```

---

## ✅ Step 7: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the app in your browser - **the map is accessible without logging in!**

3. Click the **purple Admin panel icon** (gear with settings) in the top-right

4. You'll see a **login screen** with two options:
   - **Continue with Google** - Sign in with your Google account
   - **Sign In with Email** - Use the email/password you created in Step 3

5. After signing in, the admin panel will open with three tabs

6. Click **"Overview"** tab to see statistics

7. Try uploading media:
   - Click **"Add Media"** button
   - Select **"Upload File"**
   - Choose a test image
   - Fill in the details
   - Click **"Add Media"**

8. **Expected results:**
   - ✅ Upload succeeds and media appears in the Media tab
   - ✅ You can delete media from the Media tab
   - ✅ Media appears on the map and timeline
   - ✅ The main map and sidebar work without authentication

---

## 🔧 Troubleshooting

### "Permission denied" error when uploading

**Causes:**
1. You're not signed in
2. Your UID doesn't match the one in `storage.rules`
3. Storage rules haven't been deployed

**Fix:**
```bash
# 1. Check if you're signed in (browser console):
getAuth().currentUser?.uid

# 2. Verify UID matches storage.rules

# 3. Redeploy rules:
firebase deploy --only storage
```

### "Firebase not configured" error

**Fix:**
- Make sure `.env.local` exists with correct Firebase config
- Restart development server after creating `.env.local`

### "Module not found: firebase/app"

**Fix:**
```bash
npm install firebase
```

### Google sign-in popup blocked or fails

**Causes:**
1. Popup blocker is enabled
2. Domain not authorized in Firebase

**Fix:**
```
1. Allow popups for localhost in your browser
2. In Firebase Console → Authentication → Settings → Authorized domains
3. Make sure your domain (localhost, your-domain.com) is listed
4. Add your production domain when deploying
```

---

## 🎛️ Admin Panel Features

### Login Options
- **Google Sign-In**: Quick one-click authentication with your Google account
- **Email/Password**: Traditional login with credentials you set up in Firebase Console

### Once Signed In

The Admin Panel provides:

### Overview Tab
- **Statistics**: View total segments and media count
- **Quick Actions**: Add media or bulk import
- **Account Info**: See signed-in user and sign out

### Media Tab
- **View All Media**: See all uploaded photos and videos with thumbnails
- **Media Info**: View segment number, type, and date for each item
- **Delete Media**: Remove media from both Firebase Storage and the app
- **Add Media**: Quick access to upload new media

### Storage Tab
- **Provider Info**: Shows Firebase Storage configuration
- **User ID**: Displays your Firebase Auth UID for reference
- **Setup Instructions**: Reminders for configuring storage rules

---

## 📁 File Structure

```
roadtrip-map/
├── src/
│   ├── components/
│   │   ├── AdminPanel.vue       # Admin panel with media management
│   │   ├── AdminLogin.vue       # Login screen
│   │   └── AddMediaForm.vue     # Media upload form
│   ├── composables/
│   │   └── useAuth.ts           # Authentication state & logic
│   ├── config/
│   │   └── firebase.ts          # Firebase initialization (Auth, Storage, Firestore)
│   ├── services/
│   │   └── storage.ts           # Upload service (uses Firebase Storage)
│   └── stores/
│       └── roadtrip.ts          # Main store (uses Firestore for persistence)
├── .env.local                   # Your Firebase config (gitignored)
├── .env.example                 # Template for .env.local
├── storage.rules                # Storage security rules (UPDATE YOUR UID HERE!)
├── firestore.rules              # Firestore security rules (UPDATE YOUR UID HERE!)
├── firebase.json                # Firebase project config
└── .firebaserc                  # Links to Firebase project
```

---

## 🔐 Security Notes

### Current Setup:
- ✅ **Authentication required** - Must sign in to access admin panel
- ✅ **Only you** can upload (restricted by UID in storage rules)
- ✅ **Everyone** can view uploaded media (public read)
- ✅ **Only you** can delete media (restricted by UID)
- ✅ **File size limits**:
  - Media files: 100MB max
  - Thumbnails: 5MB max

### To make everything private:

Edit `storage.rules`:
```javascript
match /media/{allPaths=**} {
  // Only you can read AND write
  allow read: if request.auth.uid == 'YOUR_UID';
  allow write: if request.auth.uid == 'YOUR_UID';
}
```

Then redeploy:
```bash
firebase deploy --only storage
```

---

## 💰 Storage Costs

**Firebase Storage Free Tier:**
- 5GB storage
- 1GB/day downloads
- 20K/day uploads

**After free tier:**
- Storage: $0.026 per GB/month
- Downloads: $0.12 per GB
- Uploads: $0.05 per GB

**For 1000 photos (~5GB):**
- Monthly cost: ~$0.13 (within free tier!)

---

## 📚 Next Steps

Once setup is complete:

1. **Test uploads** - Make sure you can upload media
2. **Add authentication** - Implement sign-in if not already done
3. **Deploy to production** - Deploy rules to production environment
4. **Backup strategy** - Consider exporting data regularly

---

## 🆘 Need Help?

- Firebase Console: https://console.firebase.google.com/project/interactive-roadtrip
- Firebase Docs: https://firebase.google.com/docs/storage
- Storage Rules Docs: https://firebase.google.com/docs/storage/security

---

**You're all set!** 🎉 Only you can now upload media to your road trip map.
