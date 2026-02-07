import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Zod Schema for Policy Creation (Wizard Input)
export const CreatePolicySchema = z.object({
    userId: z.string().uuid().optional(), // Optional because we might pull from session
    cropId: z.string().min(1, "Crop selection is required"),
    locationName: z.string().min(1, "Location name is required"),
    coordinates: z.object({
        lat: z.number(),
        lng: z.number(),
    }),
    coverageAmount: z.number().positive("Coverage must be positive"),
    riskThreshold: z.number().min(0).max(100), // e.g. 50% deficit
});

export type CreatePolicyInput = z.infer<typeof CreatePolicySchema>;

// Type for Dashboard display
export type PolicyWithDetails = Prisma.PolicyGetPayload<{
    include: {
        weatherLogs: {
            orderBy: { timestamp: 'desc' },
            take: 1
        }
    }
}>;

// Type for Insurer Dashboard Stats
export type InsurerStats = {
    totalValueLocked: number;
    activePolicies: number;
    riskExposure: {
        high: number;
        medium: number;
        low: number;
    };
    recentLogs: Prisma.WeatherLogGetPayload<{
        include: { policy: true }
    }>[];
};
