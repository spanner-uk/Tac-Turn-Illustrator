export function formatSeconds(value: number): string {
  return `${value.toFixed(1)} s`;
}

export function formatNm(value: number): string {
  return `${value.toFixed(1)} NM`;
}

export function formatDegrees(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} deg`;
}

export function formatG(value: number): string {
  return `${value.toFixed(1)} G`;
}
