const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const OUTPUT_SIZE = 256;
const JPEG_QUALITY = 0.85;

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

function cropSquareCanvas(img) {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen');

  ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return canvas;
}

/**
 * @param {File} file
 * @returns {Promise<string>} data URL JPEG con fondo blanco
 */
export async function readAndCompressAvatar(file) {
  if (!file || !(file instanceof File)) {
    throw new Error('Seleccioná una imagen');
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error('Formato no soportado. Usá JPEG, PNG o WebP.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('La imagen es demasiado grande (máx. 4 MB)');
  }

  const img = await loadImageFromFile(file);
  const canvas = cropSquareCanvas(img);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

  if (dataUrl.length > 170_000) {
    throw new Error('La imagen comprimida sigue siendo muy grande. Probá con otra foto.');
  }

  return dataUrl;
}

export function getInitials(name) {
  return String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
