// Color extraction utility using quantization

export interface ThemePalette {
  primary: string;
  secondary: string;
  muted: string;
  background: string;
}

// Helper: Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

// Helper: Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Helper: Calculate luminance
function getLuminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export const extractDominantColor = async (imageUrl: string): Promise<ThemePalette | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // Resize for speed
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);

      const imageData = ctx.getImageData(0, 0, 100, 100).data;
      const pixels: {r: number, g: number, b: number}[] = [];

      for (let i = 0; i < imageData.length; i += 4 * 5) { // Sample more frequently (every 5th)
          const r = imageData[i];
          const g = imageData[i+1];
          const b = imageData[i+2];
          const a = imageData[i+3];

          if (a < 128) continue;

          // Skip very dark or very white pixels to avoid boring colors
          const hsl = rgbToHsl(r, g, b);
          // Keep a bit more range than before, but still avoid extremes for palette picking
          if (hsl[2] < 0.05 || hsl[2] > 0.95) continue;

          pixels.push({r, g, b});
      }

      if (pixels.length === 0) {
        resolve(null);
        return;
      }

      // Simple Quantization
      const buckets: Record<string, {r: number, g: number, b: number, count: number}> = {};

      pixels.forEach(p => {
          const key = `${Math.floor(p.r/24)},${Math.floor(p.g/24)},${Math.floor(p.b/24)}`; // Smaller buckets for more precision
          if (!buckets[key]) buckets[key] = {r:0, g:0, b:0, count:0};
          buckets[key].r += p.r;
          buckets[key].g += p.g;
          buckets[key].b += p.b;
          buckets[key].count++;
      });

      const sortedBuckets = Object.values(buckets).map(b => ({
          r: Math.round(b.r / b.count),
          g: Math.round(b.g / b.count),
          b: Math.round(b.b / b.count),
          count: b.count
      })).sort((a, b) => b.count - a.count);

      // Extract Palette Candidates
      const primaryCandidate = sortedBuckets[0] || {r:255, g:255, b:255};
      
      // Helper to ensure color is light enough for dark background
      const ensureLightness = (c: {r: number, g: number, b: number}, minL: number): {r: number, g: number, b: number} => {
        const [h, s, l] = rgbToHsl(c.r, c.g, c.b);
        if (l < minL) {
          const [nR, nG, nB] = hslToRgb(h, s, Math.max(l, minL));
          return { r: nR, g: nG, b: nB };
        }
        return c;
      };

      // Helper to ensure color is dark enough for background
      const ensureDarkness = (c: {r: number, g: number, b: number}, maxL: number): {r: number, g: number, b: number} => {
         const [h, s, l] = rgbToHsl(c.r, c.g, c.b);
         if (l > maxL) {
           const [nR, nG, nB] = hslToRgb(h, s, Math.min(l, maxL));
           return { r: nR, g: nG, b: nB };
         }
         return c;
      };
      
      // 1. Background: Based on primary but very dark
      // We want background to be colored but dark (e.g. L < 0.1)
      const bgBase = sortedBuckets[0] || {r:10, g:10, b:10}; // Use most dominant for BG base
      const backgroundRGB = ensureDarkness(bgBase, 0.2); // Relaxed to 20% to allow richer colors (like brown)

      // 2. Primary: Main accent color. Should be visible on background.
      // Use the most dominant color, but ensure it's light enough (e.g. L > 0.5)
      let primaryRGB = ensureLightness(primaryCandidate, 0.55);

      // 3. Secondary: Distinct from primary
      let secondaryCandidate = sortedBuckets.find(c => {
         const diff = Math.abs(c.r - primaryCandidate.r) + Math.abs(c.g - primaryCandidate.g) + Math.abs(c.b - primaryCandidate.b);
         return diff > 80;
      }) || sortedBuckets[1] || primaryCandidate;
      let secondaryRGB = ensureLightness(secondaryCandidate, 0.5);

      // 4. Muted: Another distinct or less saturated color
      let mutedCandidate = sortedBuckets.find(c => {
         const diffP = Math.abs(c.r - primaryCandidate.r) + Math.abs(c.g - primaryCandidate.g) + Math.abs(c.b - primaryCandidate.b);
         const diffS = Math.abs(c.r - secondaryCandidate.r) + Math.abs(c.g - secondaryCandidate.g) + Math.abs(c.b - secondaryCandidate.b);
         return diffP > 50 && diffS > 50;
      }) || sortedBuckets[2] || secondaryCandidate;
      // Muted can be slightly darker than primary/secondary but still needs to be visible
      let mutedRGB = ensureLightness(mutedCandidate, 0.4);

      // Formatting
      const toStr = (c: {r:number, g:number, b:number}) => `rgb(${c.r}, ${c.g}, ${c.b})`;

      resolve({
          primary: toStr(primaryRGB),
          secondary: toStr(secondaryRGB),
          muted: toStr(mutedRGB),
          background: toStr(backgroundRGB)
      });
    };

    img.onerror = () => {
      resolve(null);
    };
  });
};
