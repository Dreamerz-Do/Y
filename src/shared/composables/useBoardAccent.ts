/**
 * Board accent is colour channel 1 (spec 7.3): it colours the app chrome only,
 * never individual items. The active board sets a single hue here; the token
 * CSS derives the accent colour from it, in both light and dark.
 */
export function useBoardAccent() {
  function setHue(hue: number | null): void {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (hue == null) root.style.removeProperty('--board-hue')
    else root.style.setProperty('--board-hue', String(hue))
  }

  return { setHue }
}
