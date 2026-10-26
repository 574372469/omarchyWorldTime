// Color helpers shared by the DOM and the canvases. The canvases need real
// color values, so everything here returns hex or rgba() strings.

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1)}`;
}

/** Opaque blend, the same arithmetic as Elsewhen's Model.mix. */
export function mix(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  });
}

/** Qt.darker: scale the HSV value down by `factor`, keeping hue and saturation. */
export function darken(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const v = max / factor;
  if (max === 0) return hex;
  const s = max === min ? 0 : (max - min) / max;
  const h =
    max === min
      ? 0
      : max === rn
        ? ((gn - bn) / (max - min) + (gn < bn ? 6 : 0)) / 6
        : max === gn
          ? ((bn - rn) / (max - min) + 2) / 6
          : ((rn - gn) / (max - min) + 4) / 6;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const out =
    i % 6 === 0
      ? [v, t, p]
      : i === 1
        ? [q, v, p]
        : i === 2
          ? [p, v, t]
          : i === 3
            ? [p, q, v]
            : i === 4
              ? [t, p, v]
              : [v, p, q];
  return rgbToHex({ r: out[0] * 255, g: out[1] * 255, b: out[2] * 255 });
}

/** The same color with an alpha, as a CSS/canvas string. */
export function alpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  const k = Math.max(0, Math.min(1, a));
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${k})`;
}

/** Whether a palette reads as light, for canvas ink that has to flip. */
export function isLight(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}
