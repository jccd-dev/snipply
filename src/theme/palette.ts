// Centralized pastel color palette and deterministic picker
// Goals: visual harmony, readability, performance, maintainability, scalability, consistent UX

// A curated set of soft, readable pastels across the hue wheel.
// Colors are chosen for medium contrast on light/dark backgrounds when used subtly
// (borders, dots, soft hover tints). Avoid extremely light values that wash out.
export const pastelPalette: readonly string[] = [
  // Violets / Purples
  "#DCC6FF", // soft lavender
  "#E2D1FF", // light periwinkle
  "#F2D7FF", // lilac
  // Blues
  "#CFE7FF", // powder blue
  "#D6F0FF", // baby blue
  "#D4EEFF", // sky tint
  // Cyans / Teals
  "#CFF7F4", // aqua mint
  "#D0F2EA", // seafoam
  "#D6F6F0", // pale teal
  // Greens
  "#DDF6D0", // honeydew green
  "#E3F6D5", // pale spring
  "#E7F8D9", // mint grass
  // Limes / Chartreuse
  "#E8F9C9",
  "#EEF9D3",
  // Yellows
  "#FFF4C8", // vanilla
  "#FFF1CC", // custard
  // Oranges / Peach
  "#FFE6C9", // peach
  "#FFE1D3", // light coral peach
  // Reds / Rose
  "#FFD7E1", // rose
  "#FFD1DC", // pink
  // Magentas
  "#F9D0EE", // orchid pink
  "#F5D3F7", // pale magenta
] as const;

export function getPalette(): readonly string[] {
  return pastelPalette;
}

// Deterministic pseudo-random selection from the palette based on an input key.
// We use a fast 32-bit FNV-1a hash to map the key to a stable index.
export function pickColorDeterministic(key: string): string {
  const idx = fnv1a32(key) % pastelPalette.length;
  return pastelPalette[idx < 0 ? (idx + pastelPalette.length) % pastelPalette.length : idx];
}

// FNV-1a 32-bit hash for strings
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5 >>> 0; // offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // multiply by FNV prime 16777619 (mod 2^32)
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Return signed 32-bit for easier modulo handling
  return (hash | 0);
}

// Optional utility: pick next color (for future scalability like rotating through colors)
export function pickNextColor(previousKey: string, step = 1): string {
  const base = fnv1a32(previousKey);
  const idx = Math.abs((base + step) % pastelPalette.length);
  return pastelPalette[idx];
}