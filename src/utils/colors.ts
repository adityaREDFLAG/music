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

// Helper: Calculate luminance
function getLuminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Helper: Check contrast ratio (simple version)
function getContrast(rgb1: number[], rgb2: number[]) { // rgb2 is usually white/black
    const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
    const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
    return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
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

      // Resize for speed (larger than before for better variety)
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);

      const imageData = ctx.getImageData(0, 0, 100, 100).data;
      const pixelCount = imageData.length / 4;

      const pixels: {r: number, g: number, b: number}[] = [];

      for (let i = 0; i < imageData.length; i += 4 * 10) { // Sample every 10th
          const r = imageData[i];
          const g = imageData[i+1];
          const b = imageData[i+2];
          const a = imageData[i+3];

          if (a < 128) continue;

          // Skip very dark or very white pixels to avoid boring colors
          const hsl = rgbToHsl(r, g, b);
          if (hsl[2] < 0.1 || hsl[2] > 0.9) continue;

          pixels.push({r, g, b});
      }

      if (pixels.length === 0) {
        resolve(null);
        return;
      }

      // Simple Quantization: Box everything into 32x32x32 buckets
      const buckets: Record<string, {r: number, g: number, b: number, count: number}> = {};

      pixels.forEach(p => {
          const key = `${Math.floor(p.r/32)},${Math.floor(p.g/32)},${Math.floor(p.b/32)}`;
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

      // Extract Palette
      const primary = sortedBuckets[0] || {r:24, g:24, b:27};

      // Find secondary (most distinct from primary)
      let secondary = sortedBuckets.find(c => {
         const diff = Math.abs(c.r - primary.r) + Math.abs(c.g - primary.g) + Math.abs(c.b - primary.b);
         return diff > 100; // Threshold
      }) || sortedBuckets[1] || primary;

      // Find muted (lower saturation or different hue)
      let muted = sortedBuckets.find(c => {
         // different from primary and secondary
         const diffP = Math.abs(c.r - primary.r) + Math.abs(c.g - primary.g) + Math.abs(c.b - primary.b);
         const diffS = Math.abs(c.r - secondary.r) + Math.abs(c.g - secondary.g) + Math.abs(c.b - secondary.b);
         return diffP > 50 && diffS > 50;
      }) || sortedBuckets[2] || secondary;

      const toStr = (c: {r:number, g:number, b:number}) => `rgb(${c.r}, ${c.g}, ${c.b})`;

      // Ensure good background color (dark version of primary)
      const primaryHSL = rgbToHsl(primary.r, primary.g, primary.b);
      // Darken for background
      const bgR = Math.floor(primary.r * 0.2);
      const bgG = Math.floor(primary.g * 0.2);
      const bgB = Math.floor(primary.b * 0.2);

      resolve({
          primary: toStr(primary),
          secondary: toStr(secondary),
          muted: toStr(muted),
          background: `rgb(${bgR}, ${bgG}, ${bgB})`
      });
    };

    img.onerror = () => {
      resolve(null);
    };
  });
};
