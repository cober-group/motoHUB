/**
 * Utility for processing product images and removing white backgrounds.
 */

const imageCache = new Map<string, string>();

export const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMjQiIGZpbGw9IiMxYTExYTEiLz4KPHBhdGggZD0iTTI1NiAxNDhMMTQ4IDIwNlYzMDZMMjU2IDM2NEwzNjQgMzA2VjIwNkwyNTYgMTQ4WiIgc3Ryb2tlPSIjYzhmZjFkIiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTI1NiAxNDhWMzY0IiBzdHJva2U9IiNjOGZmMWQiIHN0cm9rZS13aWR0aD0iOCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNMTQ4IDIwNkwyNTYgMjY0TDM2NCAyMDYiIHN0cm9rZT0iI2M4ZmYxZCIgc3Ryb2tlLXdpZHRoPSI4IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';

export async function processProductImage(base64: string): Promise<string> {
  if (!base64) return PLACEHOLDER_IMAGE;
  
  const fullBase64 = base64.startsWith('data:image') ? base64 : `data:image/png;base64,${base64}`;
  
  if (imageCache.has(fullBase64)) return imageCache.get(fullBase64)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = fullBase64;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(fullBase64); return; }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple white-removal algorithm
      // Threshold for "near white": R,G,B > 245
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > 245 && g > 245 && b > 245) {
          data[i + 3] = 0; // Set alpha to 0
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const result = canvas.toDataURL('image/png');
      imageCache.set(fullBase64, result);
      resolve(result);
    };

    img.onerror = () => {
      resolve(fullBase64);
    };
  });
}
