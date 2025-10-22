export const TRIP_START_DATE = new Date('2025-08-12T00:00:00Z')
export const TRIP_END_DATE = new Date('2025-10-09T23:59:59Z')

export const TRIP_TOTAL_DAYS = 59
export const TRIP_DURATION_MS = TRIP_END_DATE.getTime() - TRIP_START_DATE.getTime()
