export type RegionKey = 'bac' | 'trung' | 'nam';

export interface Province {
  id: string;
  name: string;
  region: RegionKey;
  regionName: string;
  subRegion: string; // 'Tây Bắc', 'Đông Bắc', 'ĐBSH', 'Bắc Trung Bộ', 'Nam Trung Bộ', 'Tây Nguyên', 'Đông Nam Bộ', 'ĐBSCL'
  lat: number;
  lng: number;
  x: number; // SVG map X coordinate (0-450)
  y: number; // SVG map Y coordinate (0-780)
  famousPlaces: string[];
  description: string;
  isCoastal?: boolean;
  isMountain?: boolean;
}

export interface Activity {
  time: string;
  locationName: string;
  description: string;
  estimatedCost: string;
  isDone?: boolean;
}

export interface DayItinerary {
  day: number;
  activities: Activity[];
}

export interface TravelItinerary {
  id?: string;
  title: string;
  summary: string;
  destination: string;
  duration: string;
  companions: string;
  preferences: string;
  budget: string;
  itinerary: DayItinerary[];
  createdAt?: string;
}

export interface JournalEntry {
  id: string;
  imageUrl: string;
  location: string;
  mood: string;
  caption: string;
  journalText: string;
  hashtags: string[];
  date: string;
  likes?: number;
}

export interface TravelRecommendation {
  guAnalysis: string;
  nextDestination: string;
  reason: string;
  experiences: string[];
}

export interface DemoPhoto {
  id: string;
  title: string;
  location: string;
  mood: string;
  imageUrl: string;
  previewUrl: string;
}
