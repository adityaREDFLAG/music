
export async function extractPrimaryColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve('#6750A4');
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);
      const data = ctx.getImageData(0, 0, 100, 100).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      r = Math.floor(r / (data.length / 4));
      g = Math.floor(g / (data.length / 4));
      b = Math.floor(b / (data.length / 4));
      
      // Basic saturation boost to make it more "Material Expressive"
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 30) { // If too gray, default to purple
        return resolve('#6750A4');
      }
      
      resolve(`rgb(${r}, ${g}, ${b})`);
    };
    img.onerror = () => resolve('#6750A4');
  });
}
