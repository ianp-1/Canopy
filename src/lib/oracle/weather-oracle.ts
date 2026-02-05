/**
 * Weather Oracle Module
 * Fetches weather data for policy evaluation
 * 
 * Currently uses mock data for testing.
 * Designed for easy swap to real weather APIs.
 */

/**
 * Weather data structure from oracle sources
 */
export interface WeatherData {
  /** Rainfall in millimeters */
  rainfall_mm: number;
  /** Temperature in Celsius */
  temperature_c: number;
  /** Relative humidity percentage */
  humidity_percent: number;
  /** Timestamp of the measurement */
  timestamp: Date;
  /** Source of the data */
  source: 'mock' | 'openweather' | 'noaa';
}

/**
 * Mock drought conditions for testing
 * These values will always trigger a payout when threshold is 10mm
 */
const MOCK_DROUGHT_DATA: WeatherData = {
  rainfall_mm: 2,        // Well below typical 10mm threshold
  temperature_c: 38,     // High temperature indicating drought
  humidity_percent: 15,  // Low humidity
  timestamp: new Date(),
  source: 'mock',
};

/**
 * Fetch current weather data for a location
 * 
 * @param lat - Latitude of the location
 * @param lng - Longitude of the location
 * @returns Weather data for the specified location
 * 
 * @example
 * ```typescript
 * const weather = await fetchCurrentWeather(36.7783, -119.4179);
 * console.log(`Rainfall: ${weather.rainfall_mm}mm`);
 * ```
 */
export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<WeatherData> {
  // ═══════════════════════════════════════════════════════════════════════
  // TODO: Person 2 - Swap this mock implementation with OpenWeather API
  // 
  // Integration steps:
  // 1. Add OPENWEATHER_API_KEY to .env
  // 2. Install axios or use fetch
  // 3. Call: https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&appid={API_KEY}
  // 4. Parse response and map to WeatherData interface
  // 5. Add error handling for API failures
  // 6. Consider caching to reduce API calls
  //
  // Example response structure:
  // {
  //   "rain": { "1h": 3.16 },  // rainfall in mm
  //   "main": { "temp": 298.48, "humidity": 64 }
  // }
  // ═══════════════════════════════════════════════════════════════════════

  console.log(`[WeatherOracle] Fetching weather for (${lat}, ${lng})`);
  console.log(`[WeatherOracle] Using MOCK data - rainfall: ${MOCK_DROUGHT_DATA.rainfall_mm}mm`);
  
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    ...MOCK_DROUGHT_DATA,
    timestamp: new Date(),
  };
}

/**
 * Check if weather conditions indicate drought
 * 
 * @param weather - Current weather data
 * @param rainfallThreshold - Threshold in mm below which drought is triggered
 * @returns true if drought conditions are met
 */
export function isDroughtCondition(
  weather: WeatherData,
  rainfallThreshold: number
): boolean {
  return weather.rainfall_mm < rainfallThreshold;
}

/**
 * Calculate drought severity score (0-1)
 * Higher score = more severe drought
 */
export function calculateDroughtSeverity(
  weather: WeatherData,
  rainfallThreshold: number
): number {
  if (weather.rainfall_mm >= rainfallThreshold) {
    return 0;
  }
  
  // Score based on how far below threshold
  const rainfallScore = 1 - (weather.rainfall_mm / rainfallThreshold);
  
  // Bonus for high temperature (above 35°C)
  const tempBonus = weather.temperature_c > 35 ? 0.1 : 0;
  
  // Bonus for low humidity (below 20%)
  const humidityBonus = weather.humidity_percent < 20 ? 0.1 : 0;
  
  return Math.min(1, rainfallScore + tempBonus + humidityBonus);
}
