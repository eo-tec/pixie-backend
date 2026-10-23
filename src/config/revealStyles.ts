// Animaciones con las que el frame anuncia una foto nueva. Los nombres son los de
// reveal::styleName() en el firmware (Spotipyx/lib/photo_reveal); un nombre que el
// firmware no conozca le hace usar polaroid.
export const REVEAL_STYLES = ['polaroid', 'letter', 'postcard', 'film', 'print', 'newpic'] as const;
export type RevealStyle = typeof REVEAL_STYLES[number];
export const DEFAULT_REVEAL_STYLE: RevealStyle = 'polaroid';

export function isRevealStyle(value: unknown): value is RevealStyle {
  return typeof value === 'string' && (REVEAL_STYLES as readonly string[]).includes(value);
}
