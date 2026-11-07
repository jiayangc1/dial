// Paths from the Dial media kit (Rotary D + outlined wordmark). Drawn with
// currentColor so they follow the theme; only the "now" hole keeps Signal orange.
const MARK = "M27 22 H45 A28 28 0 0 1 45 78 H27 Z M43.80 32.30 a4.3 4.3 0 1 0 8.6 0 a4.3 4.3 0 1 0 -8.6 0 Z M54.50 38.40 a4.3 4.3 0 1 0 8.6 0 a4.3 4.3 0 1 0 -8.6 0 Z M58.70 50.00 a4.3 4.3 0 1 0 8.6 0 a4.3 4.3 0 1 0 -8.6 0 Z M54.50 61.60 a4.3 4.3 0 1 0 8.6 0 a4.3 4.3 0 1 0 -8.6 0 Z M43.80 67.70 a4.3 4.3 0 1 0 8.6 0 a4.3 4.3 0 1 0 -8.6 0 Z";
const WORDMARK = "M26.0 77.2Q19.20 77.2 14.25 73.80Q9.3 70.4 6.60 64.15Q3.90 57.9 3.90 49.3Q3.90 40.8 6.65 34.5Q9.4 28.19 14.35 24.79Q19.3 21.4 26.0 21.4Q31.6 21.4 35.85 23.7Q40.1 26.0 42.30 30.19V5.0H55.1V76.0H42.90L42.6 68.1Q40.40 72.4 36.0 74.80Q31.6 77.2 26.0 77.2ZM29.90 66.8Q35.80 66.8 39.05 62.25Q42.30 57.7 42.30 49.3Q42.30 40.8 39.1 36.3Q35.9 31.79 29.90 31.79Q24.1 31.79 20.65 36.45Q17.2 41.1 17.2 49.3Q17.2 57.3 20.65 62.05Q24.1 66.8 29.90 66.8Z M64.6 76.0V22.59H77.4V76.0ZM64.4 15.5V4.09H77.7V15.5Z M102.5 77.2Q94.1 77.2 89.0 73.4Q83.9 69.6 83.9 62.6Q83.9 55.7 88.2 51.8Q92.5 47.9 101.3 46.2L119.0 42.69Q119.0 31.29 108.7 31.29Q104.1 31.29 101.4 33.44Q98.7 35.59 97.8 39.6L84.8 39.0Q86.4 30.59 92.6 25.99Q98.8 21.4 108.7 21.4Q120.1 21.4 125.95 27.15Q131.8 32.9 131.8 43.6V63.0Q131.8 65.1 132.55 65.9Q133.3 66.7 134.8 66.7H136.5V76.0Q134.8 76.4 131.8 76.4Q127.5 76.4 124.5 74.6Q121.5 72.8 120.7 67.9V67.8Q118.7 72.0 113.85 74.6Q109.0 77.2 102.5 77.2ZM105.1 67.9Q111.5 67.9 115.25 64.2Q119.0 60.5 119.0 54.4V51.4L105.2 54.2Q100.9 55.09 99.05 56.84Q97.2 58.59 97.2 61.4Q97.2 67.9 105.1 67.9Z M153.3 76.0Q147.4 76.0 143.95 73.0Q140.5 70.0 140.5 63.4V5.0H153.3V62.1Q153.3 66.1 157.3 66.1H161.2V76.0Z";
export const SIGNAL = "#FF5A1F";

export function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size * (50 / 60)} height={size} viewBox="25 20 50 60" className={className} aria-hidden="true">
      <path d={MARK} fill="currentColor" fillRule="evenodd" />
      <circle cx="58.8" cy="38.4" r="4.3" fill={SIGNAL} />
    </svg>
  );
}

export function Wordmark({ height = 20, className }: { height?: number; className?: string }) {
  return (
    <svg height={height} width={(height * 171.2) / 100} viewBox="-4 0 171.2 100" className={className} aria-hidden="true">
      <path d={WORDMARK} fill="currentColor" />
    </svg>
  );
}

export function AppIcon({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx="23" className="fill-[var(--gray-1000)]" />
      <path d={MARK} className="fill-[var(--bg)]" fillRule="evenodd" />
      <circle cx="58.8" cy="38.4" r="4.3" fill={SIGNAL} />
    </svg>
  );
}
