# 🗺️ Road Trip 2025 - Interactive Map Visualization

A beautiful, feature-rich interactive map visualization of a 62-day cross-country road trip (August 10 - October 10, 2025).

![Road Trip Map](https://img.shields.io/badge/Vue.js-3.x-4FC08D?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-38B2AC?logo=tailwind-css&logoColor=white)

## ✨ Features

### 🎬 Animated Timeline Playback
- Watch your route **grow over time** with smooth animations
- Playback controls (Play/Pause, Skip, Speed control: 1x-8x)
- Real-time date display and progress tracking
- Dynamic media preview synced with timeline

### 🗺️ Interactive Map
- **Styled route lines** with shadow effects for depth
- Color-coded by month (Red → Teal → Green)
- 1,615 location data points
- Clickable segments and markers with detailed popups
- Smooth animations and hover effects

### 🔍 Search & Filter
- Search locations by type
- Date range filtering with visual timeline
- Real-time map updates

### 📸 Media Management
- Upload **photos, videos, 360° photos, and 360° videos**
- File upload or URL input support
- Gallery view with thumbnails
- Captions and timestamps
- Persistent storage (localStorage)

### 💬 Comments & Testimonials
- Add comments to any location
- Star ratings (1-5 stars)
- Author attribution and timestamps
- Edit/delete functionality

### 📊 Trip Statistics
- **Total Points:** 1,615+ GPS coordinates
- **Duration:** 62 days
- **Distance:** Calculated in miles and kilometers
- **Stops:** Tracked visits and locations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\`

The app will be available at \`http://localhost:5173/\`

## 🎯 Usage

### Timeline Playback Mode
1. Click **"Activate Timeline Playback"**
2. Press **Play** to watch your route animate
3. Use the **slider** to scrub through time
4. Adjust **playback speed** (1x-8x)
5. View **media from current time period**

### Adding Media & Comments
1. **Click any route or marker** on the map
2. Switch to **"Location Details"** tab
3. Click **"Add Media"** to upload content
4. Select type: Photo, Video, 360° Photo, or 360° Video
5. Add comments with star ratings

## 🛠️ Tech Stack

- **Frontend Framework:** Vue 3 (Composition API)
- **Language:** TypeScript
- **State Management:** Pinia
- **Styling:** Tailwind CSS 4
- **Map Library:** Leaflet
- **Icons:** Hero Icons
- **Date Handling:** date-fns
- **360° Content:** Photo Sphere Viewer
- **Video Player:** Video.js

## 📁 Project Structure

\`\`\`
roadtrip-map/
├── src/
│   ├── assets/          # Static assets and global styles
│   ├── components/      # Vue components
│   ├── stores/          # Pinia stores
│   ├── App.vue          # Root component
│   └── main.ts          # App entry point
├── public/
│   └── roadtrip2025_mod.json # Trip data (1,615 segments)
└── package.json
\`\`\`

## 🎨 Design Highlights

- **Gradient backgrounds** and color-coded stats
- **Smooth animations** (fade-in, slide-in, pop effects)
- **Professional color palette**
- **Custom scrollbars**
- **Shadow/depth effects** on routes

## 📝 License

MIT

---

**Built with ❤️ for adventure and exploration**
