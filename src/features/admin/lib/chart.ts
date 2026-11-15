/** Smallest "clean" number (1, 2, 5 x 10^n) at or above `value`: the top of a chart's axis. */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 5, 10]) {
    if (step * power >= value) return step * power
  }
  return 10 * power
}
