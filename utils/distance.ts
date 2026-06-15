import * as Localization from 'expo-localization';

const KM_TO_MILES = 0.621371;

function usesMiles(): boolean {
  const locale = Localization.getLocales()[0];
  return locale?.regionCode === 'US';
}

export function formatDistance(km: number | string): string {
  const val = typeof km === 'string' ? parseFloat(km) : km;
  if (usesMiles()) {
    return `${(val * KM_TO_MILES).toFixed(1)} mi`;
  }
  return `${val.toFixed(1)} km`;
}

export function distanceUnit(): string {
  return usesMiles() ? 'mi' : 'km';
}
