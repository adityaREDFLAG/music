export interface ThemePalette {
  primary: string;
  secondary: string;
  muted: string;
  background: string;
}

// --- Helpers ---

// RGB to HSL (0-1 range)
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; 
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
  return { h, s, l };
}

// HSL to RGB (Returns 0-255)
function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l; 
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// Check color distance (Euclidean in RGB is fast/decent enough for this)
function colorDistance(c1: {r:number, g:number, b:number}, c2: {r:number, g:number, b:number}) {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) + 
    Math.pow(c1.g - c2.g, 2) + 
    Math.pow(c1.b - c2.b, 2)
  );
}

// --- Main Logic ---

export const extractDominantColor = async (imageUrl: string): Promise<ThemePalette | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(null); return; }

      // Keep small for performance, but 128 is a good balance
      canvas.width = 128;
      canvas.height = 128;
      ctx.drawImage(img, 0, 0, 128, 128);

      const imageData = ctx.getImageData(0, 0, 128, 128).data;
      
      // We will store colors as "Quantized Buckets"
      // Instead of simple averaging, we store the "best" representative of the bucket
      const colorCounts: Record<string, { r:number, g:number, b:number, count:number, s:number, l:number }> = {};
      
      const quality = 10; // Check every 10th pixel
      
      for (let i = 0; i < imageData.length; i += 4 * quality) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        if (a < 128) continue;

        const { h, s, l } = rgbToHsl(r, g, b);

        // IGNORE boring colors for the palette generation
        // Too white (>0.95), too black (<0.05), or too gray (s < 0.05)
        if (l > 0.95 || l < 0.05) continue; 

        // Quantize: Round RGB values to nearest 10 to group similar colors
        // This prevents "muddying" by grouping tight clusters
        const qR = Math.round(r / 10) * 10;
        const qG = Math.round(g / 10) * 10;
        const qB = Math.round(b / 10) * 10;
        const key = `${qR},${qG},${qB}`;

        if (!colorCounts[key]) {
          colorCounts[key] = { r: qR, g: qG, b: qB, count: 0, s, l };
        }
        
        colorCounts[key].count++;
      }

      // Convert to array
      let colors = Object.values(colorCounts);

      // SCORING ALGORITHM
      // We don't just want the most frequent. We want the most "Vibrant Dominant".
      // Score = Count * (Saturation + SaturationBonus)
      colors.sort((a, b) => {
        const scoreA = a.count * (a.s * 2 + 0.5); // Boost saturation weight
        const scoreB = b.count * (b.s * 2 + 0.5);
        return scoreB - scoreA;
      });

      if (colors.length === 0) { resolve(null); return; }

      // 1. Pick Primary (Best Score)
      const primary = colors[0];

      // 2. Pick Secondary (Distinct from Primary)
      // Look for a color that is at least a certain "distance" away
      let secondary = colors.find(c => colorDistance(c, primary) > 100) || colors[1] || primary;

      // 3. Pick Background
      // STRATEGY: Create a dark background TINTED with the primary hue.
      // This looks much better than trying to find a black pixel in the image.
      const primaryHsl = rgbToHsl(primary.r, primary.g, primary.b);
      // Very dark (L=0.07), slight saturation (S=0.2) of the primary hue
      const bgRgb = hslToRgb(primaryHsl.h, 0.2, 0.07); 

      // 4. Muted
      // Just desaturate the primary or secondary
      const mutedRgb = hslToRgb(primaryHsl.h, Math.max(0, primaryHsl.s - 0.4), 0.6);

      // 5. Final Primary Adjusment
      // Ensure primary pops against the dark background. 
      // If primary is too dark (navy blue), lighten it up.
      let finalPrimary = primary;
      if (primary.l < 0.4) {
         const adj = hslToRgb(primaryHsl.h, primaryHsl.s, 0.6);
         finalPrimary = { ...finalPrimary, ...adj };
      }

      const toStr = (c: {r:number, g:number, b:number}) => `rgb(${c.r}, ${c.g}, ${c.b})`;

      resolve({
        primary: toStr(finalPrimary),
        secondary: toStr(secondary),
        muted: toStr(mutedRgb),
        background: toStr(bgRgb)
      });
    };

    img.onerror = () => resolve(null);
  });
};
