import { PixieTier } from '@prisma/client';

// Features gated by tier (free forces false, premium respects stored value)
const GATED_FEATURES = ['spotify_enabled', 'allow_draws', 'schedule_enabled'] as const;
type GatedFeature = typeof GATED_FEATURES[number];

const FREE_MAX_PHOTOS = 5;

/**
 * Returns the effective boolean for a gated feature.
 * - free: always false
 * - premium: returns the stored DB value
 */
export function effectiveBoolean(tier: PixieTier, feature: GatedFeature, storedValue: boolean): boolean {
  if (tier === 'free') return false;
  return storedValue;
}

/**
 * Returns the effective pictures_on_queue count.
 * - free: capped at FREE_MAX_PHOTOS
 * - premium: returns the real count
 */
export function effectivePhotos(tier: PixieTier, count: number): number {
  if (tier === 'free') return Math.min(count, FREE_MAX_PHOTOS);
  return count;
}
