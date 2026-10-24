export type FeatureName = "HOLIDATES";

export const FEATURE_FLAGS: Record<FeatureName, boolean> = {
  HOLIDATES: true,
};

export const featureFlagManager = {
  isEnabled(featureName: FeatureName): boolean {
    return FEATURE_FLAGS[featureName] ?? false;
  },

  list(): Record<FeatureName, boolean> {
    return { ...FEATURE_FLAGS };
  },
};

export function isFeatureEnabled(featureName: FeatureName): boolean {
  return featureFlagManager.isEnabled(featureName);
}
