/**
 * Weather Oracle Module
 * Fetches weather data for policy evaluation
 * 
 * Now integrates with the Python backend for real risk evaluation.
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
  source: 'mock' | 'backend' | 'openweather' | 'noaa';
}

/**
 * Backend Oracle Response (from Python API)
 */
interface BackendOracleResponse {
  p_severity_farm: number;
  sample_points: Array<{
    lat: number;
    lon: number;
    p_severity: number;
  }>;
  note: string;
}

/**
 * Environment-based backend URL
 */
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

/**
 * Mock drought conditions for testing (fallback if backend unavailable)
 */
const MOCK_DROUGHT_DATA: WeatherData = {
  rainfall_mm: 2,
  temperature_c: 38,
  humidity_percent: 15,
  timestamp: new Date(),
  source: 'mock',
};

/**
 * Evaluate risk via the Python backend
 * 
 * @param geometry - GeoJSON geometry of the farm
 * @param cropType - Type of crop being grown
 * @param date - Optional date for historical evaluation
 * @returns Severity score (0-1, higher = more severe)
 */
export async function evaluateRiskViaBackend(
  geometry: object,
  cropType: string,
  date?: string
): Promise<{ severity: number; success: boolean; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/oracle/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        geometry,
        crop_type: cropType,
        date,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WeatherOracle] Backend error: ${response.status} - ${errorText}`);
      return { severity: 0, success: false, error: errorText };
    }

    const data: BackendOracleResponse = await response.json();

    console.log(`[WeatherOracle] Backend evaluation complete`);
    console.log(`  Severity: ${(data.p_severity_farm * 100).toFixed(1)}%`);
    console.log(`  Sample points: ${data.sample_points.length}`);

    return { severity: data.p_severity_farm, success: true };
  } catch (error) {
    console.error('[WeatherOracle] Failed to reach backend:', error);
    return {
      severity: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fetch current weather data for a location
 * Falls back to mock if backend unavailable
 * 
 * @param lat - Latitude of the location
 * @param lng - Longitude of the location
 * @returns Weather data for the specified location
 */
export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<WeatherData> {
  console.log(`[WeatherOracle] Fetching weather for (${lat}, ${lng})`);

  // For now, still return mock data for simple coordinate-based queries
  // The evaluateRiskViaBackend function handles the full geometry-based evaluation
  console.log(`[WeatherOracle] Using MOCK data - rainfall: ${MOCK_DROUGHT_DATA.rainfall_mm}mm`);

  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    ...MOCK_DROUGHT_DATA,
    timestamp: new Date(),
  };
}

/**
 * Check if weather conditions indicate drought
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

  const rainfallScore = 1 - (weather.rainfall_mm / rainfallThreshold);
  const tempBonus = weather.temperature_c > 35 ? 0.1 : 0;
  const humidityBonus = weather.humidity_percent < 20 ? 0.1 : 0;

  return Math.min(1, rainfallScore + tempBonus + humidityBonus);
}
