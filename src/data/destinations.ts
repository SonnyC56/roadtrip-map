export interface Destination {
  name: string
  location: {
    lat: number
    lng: number
  }
  type: 'city' | 'national-park' | 'landmark' | 'state'
  icon: string
  reached: boolean
}

export const majorDestinations: Destination[] = [
  { name: 'New York', location: { lat: 40.7128, lng: -74.0060 }, type: 'city', icon: '🗽', reached: false },
  { name: 'Mentor, OH', location: { lat: 41.6662, lng: -81.3397 }, type: 'city', icon: '🏘️', reached: false },
  { name: 'Chicago, IL', location: { lat: 41.8781, lng: -87.6298 }, type: 'city', icon: '🌆', reached: false },
  { name: 'Mount Rushmore, SD', location: { lat: 43.8791, lng: -103.4591 }, type: 'landmark', icon: '⛰️', reached: false },
  { name: 'Grand Teton NP, WY', location: { lat: 43.7904, lng: -110.6818 }, type: 'national-park', icon: '🏔️', reached: false },
  { name: 'Yellowstone NP', location: { lat: 44.4280, lng: -110.5885 }, type: 'national-park', icon: '🌋', reached: false },
  { name: 'Glacier NP, MT', location: { lat: 48.7596, lng: -113.7870 }, type: 'national-park', icon: '❄️', reached: false },
  { name: 'Banff NP, AB', location: { lat: 51.4968, lng: -115.9281 }, type: 'landmark', icon: '🇨🇦', reached: false },
  { name: 'Kelowna, BC', location: { lat: 49.8880, lng: -119.4960 }, type: 'city', icon: '🍷', reached: false },
  { name: 'Vancouver, BC', location: { lat: 49.2827, lng: -123.1207 }, type: 'city', icon: '🌊', reached: false },
  { name: 'San Juan Islands, WA', location: { lat: 48.5312, lng: -123.0245 }, type: 'landmark', icon: '🏝️', reached: false },
  { name: 'Olympic NP, WA', location: { lat: 47.8021, lng: -123.6044 }, type: 'national-park', icon: '🌲', reached: false },
  { name: 'Mount Rainier NP, WA', location: { lat: 46.8523, lng: -121.7603 }, type: 'national-park', icon: '🗻', reached: false },
  { name: 'Mount St. Helens, WA', location: { lat: 46.1912, lng: -122.1944 }, type: 'landmark', icon: '🌋', reached: false },
  { name: 'Portland, OR', location: { lat: 45.5155, lng: -122.6789 }, type: 'city', icon: '🌹', reached: false },
  { name: 'Crater Lake NP, OR', location: { lat: 42.8684, lng: -122.1685 }, type: 'national-park', icon: '💙', reached: false },
  { name: 'Crescent City, CA', location: { lat: 41.7557, lng: -124.2026 }, type: 'city', icon: '🌊', reached: false },
  { name: 'Redwood NP, CA', location: { lat: 41.2132, lng: -124.0046 }, type: 'national-park', icon: '🌲', reached: false },
  { name: 'Fort Bragg, CA', location: { lat: 39.4457, lng: -123.8053 }, type: 'city', icon: '🏖️', reached: false },
  { name: 'Santa Cruz, CA', location: { lat: 36.9741, lng: -122.0308 }, type: 'city', icon: '🎢', reached: false },
  { name: 'Monterey, CA', location: { lat: 36.6002, lng: -121.8947 }, type: 'city', icon: '🦦', reached: false },
  { name: 'Carmel-by-the-Sea, CA', location: { lat: 36.5552, lng: -121.9233 }, type: 'city', icon: '🎨', reached: false },
  { name: 'Pinnacles NP, CA', location: { lat: 36.4906, lng: -121.1825 }, type: 'national-park', icon: '🦅', reached: false },
  { name: 'Morro Bay, CA', location: { lat: 35.3658, lng: -120.8499 }, type: 'city', icon: '🪨', reached: false },
  { name: 'Santa Barbara, CA', location: { lat: 34.4208, lng: -119.6982 }, type: 'city', icon: '🌴', reached: false },
  { name: 'Ventura, CA', location: { lat: 34.2746, lng: -119.2290 }, type: 'city', icon: '🏄', reached: false },
  { name: 'Channel Islands NP, CA', location: { lat: 34.0069, lng: -119.7785 }, type: 'national-park', icon: '🏝️', reached: false },
  { name: 'Los Angeles, CA', location: { lat: 34.0522, lng: -118.2437 }, type: 'city', icon: '🎬', reached: false },
  { name: 'San Diego, CA', location: { lat: 32.7157, lng: -117.1611 }, type: 'city', icon: '🌮', reached: false },
  { name: 'Tijuana, MX', location: { lat: 32.5149, lng: -117.0382 }, type: 'city', icon: '🇲🇽', reached: false },
  { name: 'Joshua Tree NP, CA', location: { lat: 33.8734, lng: -115.9010 }, type: 'national-park', icon: '🌵', reached: false },
  { name: 'Las Vegas, NV', location: { lat: 36.1699, lng: -115.1398 }, type: 'city', icon: '🎰', reached: false },
  { name: 'Death Valley NP', location: { lat: 36.5323, lng: -116.9325 }, type: 'national-park', icon: '🏜️', reached: false },
  { name: 'Boulder City, NV', location: { lat: 35.9786, lng: -114.8325 }, type: 'city', icon: '🏘️', reached: false },
  { name: 'Hoover Dam', location: { lat: 36.0161, lng: -114.7377 }, type: 'landmark', icon: '🏗️', reached: false },
  { name: 'Grand Canyon, AZ', location: { lat: 36.1069, lng: -112.1129 }, type: 'national-park', icon: '🏞️', reached: false },
  { name: 'Zion NP, UT', location: { lat: 37.2982, lng: -113.0263 }, type: 'national-park', icon: '⛰️', reached: false },
  { name: 'Bryce Canyon NP, UT', location: { lat: 37.5930, lng: -112.1871 }, type: 'national-park', icon: '🪨', reached: false },
  { name: 'Salt Lake City, UT', location: { lat: 40.7608, lng: -111.8910 }, type: 'city', icon: '🏔️', reached: false },
  { name: 'Arches NP, UT', location: { lat: 38.7331, lng: -109.5925 }, type: 'national-park', icon: '🌉', reached: false },
  { name: 'Red Rocks, CO', location: { lat: 39.6654, lng: -105.2057 }, type: 'landmark', icon: '🎸', reached: false },
  { name: 'Gateway Arch NP, MO', location: { lat: 38.6247, lng: -90.1848 }, type: 'national-park', icon: '🌁', reached: false },
  { name: 'Kansas', location: { lat: 38.5266, lng: -96.7265 }, type: 'state', icon: '🌾', reached: false },
  { name: 'Missouri', location: { lat: 38.4561, lng: -92.2884 }, type: 'state', icon: '🏛️', reached: false },
  { name: 'Illinois', location: { lat: 40.3495, lng: -88.9861 }, type: 'state', icon: '🌽', reached: false },
  { name: 'Kentucky', location: { lat: 37.6690, lng: -84.6701 }, type: 'state', icon: '🐴', reached: false },
  { name: 'West Virginia', location: { lat: 38.4912, lng: -80.9546 }, type: 'state', icon: '⛰️', reached: false },
  { name: 'New River Gorge NP, WV', location: { lat: 37.9739, lng: -81.0629 }, type: 'national-park', icon: '🌉', reached: false },
  { name: 'Baltimore, MD', location: { lat: 39.2904, lng: -76.6122 }, type: 'city', icon: '🦀', reached: false },
  { name: 'Home (Upstate NY)', location: { lat: 43.1246, lng: -75.3070 }, type: 'city', icon: '🏡', reached: false },
]
