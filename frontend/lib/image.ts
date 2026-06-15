// Client-side image preparation for the photo-solve feature.
//
// Goal: the upload should "never fail" for any normal phone photo or screenshot.
// We decode the picked file, fix EXIF rotation, downscale it, and re-encode it as a
// compact JPEG. That removes the two most common failure modes — oversized phone
// photos (often 4-12 MB) and odd source formats — before anything reaches the network.
//
// If the browser cannot decode the file at all (e.g. HEIC on Chrome), we fall back to
// sending a supported original when it is small enough, and otherwise raise a clear,
// actionable error instead of a silent failure.

export type UploadImage = { base64: string; mimeType: string };

const SUPPORTED_ORIGINAL = ["image/jpeg", "image/png", "image/webp"];
const MAX_DIMENSION = 2000; // px on the longest edge — plenty for OCR, keeps bytes small
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // must match the backend ceiling
const QUALITY_STEPS = [0.85, 0.72, 0.6, 0.45];

export async function prepareImageForUpload(file: File): Promise<UploadImage> {
  // Preferred path: decode + downscale + re-encode to a small JPEG.
  const compressed = await compressImage(file).catch(() => null);
  if (compressed) return compressed;

  // Fallback: the browser couldn't decode it (e.g. HEIC on Chrome). If it is already a
  // supported, reasonably small file, send it untouched so the request still succeeds.
  if (SUPPORTED_ORIGINAL.includes(file.type) && file.size > 0 && file.size <= MAX_UPLOAD_BYTES) {
    return { base64: await blobToBase64(file), mimeType: file.type };
  }

  throw new Error(
    "I couldn't read that image in this browser. Try a JPEG or PNG screenshot, or type the problem instead.",
  );
}

async function compressImage(file: File): Promise<UploadImage> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("Canvas image pipeline unavailable.");
  }

  // `imageOrientation: "from-image"` applies EXIF rotation so sideways phone photos
  // are uploaded upright (some browsers ignore EXIF otherwise).
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  } as ImageBitmapOptions);

  try {
    if (!bitmap.width || !bitmap.height) throw new Error("Empty image.");
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas context.");
    // White matte so transparent PNGs don't become black blocks once flattened to JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Step the quality down until the encoded image fits comfortably under the ceiling.
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        return { base64: await blobToBase64(blob), mimeType: "image/jpeg" };
      }
    }
    throw new Error("Image too large to compress.");
  } finally {
    bitmap.close?.();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : "");
    };
    reader.readAsDataURL(blob);
  });
}
