/**
 * Fixed colour palettes, imported from the design. These are the *only*
 * colours the UI may use for the three colour channels in spec 7.3. There is
 * deliberately no free colour picker: a self-chosen colour would collide with
 * the member and board channels and blur the meaning.
 *
 * Colour never carries meaning on its own (spec hard rule 6 / 7.8) — every use
 * pairs it with text, an initial or an icon.
 */

/** Item accent colours — channel 3, the narrow left bar. */
export const ITEM_COLORS = [
  { key: 'red', hue: 25 },
  { key: 'amber', hue: 70 },
  { key: 'green', hue: 150 },
  { key: 'blue', hue: 210 },
  { key: 'purple', hue: 275 },
  { key: 'pink', hue: 330 },
] as const

export type ItemColorKey = (typeof ITEM_COLORS)[number]['key']

/** Board accent hues — channel 1, app chrome only. */
export const BOARD_ACCENT_HUES = [215, 260, 170, 25, 320, 100] as const

/** OKLCH string for an item accent bar. */
export function itemColorCss(key: ItemColorKey): string {
  const entry = ITEM_COLORS.find((c) => c.key === key)
  if (!entry) throw new Error(`Unknown item colour: ${key}`)
  return `oklch(64% 0.16 ${entry.hue})`
}

/** OKLCH string for a member avatar — channel 2. */
export function memberColorCss(hue: number): string {
  return `oklch(60% 0.14 ${hue})`
}

/** Board dot on the overview, a touch darker than the chrome accent. */
export function boardDotCss(hue: number): string {
  return `oklch(50% 0.1 ${hue})`
}

/** A stable-ish hue for a member, derived from their id when none is stored. */
export function hueFromId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360
  }
  return hash
}
