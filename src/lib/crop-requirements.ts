/**
 * Crop Requirements Configuration
 * 
 * Defines the thresholds for each crop type used by the oracle
 * to evaluate drought/stress severity.
 */

export interface CropThresholds {
  /** Weekly rainfall need in mm */
  weeklyRainNeedMm: number;
  /** Heat stress threshold in Kelvin */
  heatThresholdK: number;
  /** VPD stress threshold in kPa */
  vpdThresholdKpa: number;
  /** Human-readable description */
  description: string;
}

export const CROP_REQUIREMENTS: Record<string, CropThresholds> = {
  corn: {
    weeklyRainNeedMm: 45,
    heatThresholdK: 308, // ~35°C
    vpdThresholdKpa: 1.6,
    description: 'Corn - High water demand, heat sensitive during tasseling',
  },
  wheat: {
    weeklyRainNeedMm: 35,
    heatThresholdK: 303, // ~30°C
    vpdThresholdKpa: 1.4,
    description: 'Wheat - Lower water needs, cool-season crop',
  },
  soy: {
    weeklyRainNeedMm: 40,
    heatThresholdK: 305, // ~32°C  
    vpdThresholdKpa: 1.5,
    description: 'Soy - Moderate water needs, sensitive to VPD stress',
  },
  other: {
    weeklyRainNeedMm: 45,
    heatThresholdK: 308,
    vpdThresholdKpa: 1.6,
    description: 'Other - Default thresholds based on corn',
  },
};

export const CROP_TYPES = Object.keys(CROP_REQUIREMENTS) as Array<keyof typeof CROP_REQUIREMENTS>;

export function getCropThresholds(cropType: string): CropThresholds {
  return CROP_REQUIREMENTS[cropType.toLowerCase()] || CROP_REQUIREMENTS.other;
}

/** Severity threshold for triggering payout (0-1 scale) */
export const SEVERITY_THRESHOLD = 0.85;
