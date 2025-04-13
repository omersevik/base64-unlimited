// Web Worker for Image Processing
// This runs in a separate thread to prevent UI blocking

// Handle messages from the main thread
self.onmessage = function (e) {
  const { type, data } = e.data;

  switch (type) {
    case "process":
      processImage(data);
      break;
    case "resize":
      resizeImage(data);
      break;
    default:
      self.postMessage({
        type: "error",
        error: "Unknown command",
      });
  }
};

// Process an image to base64
function processImage(data) {
  const { imageData, id, fileName, options } = data;

  try {
    // Create a blob from the array buffer
    const blob = new Blob([imageData]);
    const blobUrl = URL.createObjectURL(blob);

    // Load the image
    const img = new Image();

    img.onload = function () {
      // If resize is needed, resize first then convert
      if (options && options.resize) {
        // Calculate dimensions
        const dimensions = calculateDimensions(
          img.width,
          img.height,
          options.width,
          options.height,
          options.maintainAspect
        );

        // Create a canvas for resizing
        const canvas = document.createElement("canvas");
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        // Draw on canvas with new dimensions
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

        // Get base64 data
        const base64 = canvas.toDataURL(getMimeType(fileName));

        // Send the result back
        self.postMessage({
          type: "result",
          id: id,
          fileName: fileName,
          base64: base64,
          originalSize: imageData.byteLength,
          width: dimensions.width,
          height: dimensions.height,
        });
      } else {
        // No resize needed, create a canvas with original dimensions
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw on canvas
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Get base64 data
        const base64 = canvas.toDataURL(getMimeType(fileName));

        // Send the result back
        self.postMessage({
          type: "result",
          id: id,
          fileName: fileName,
          base64: base64,
          originalSize: imageData.byteLength,
          width: img.width,
          height: img.height,
        });
      }

      // Clean up
      URL.revokeObjectURL(blobUrl);
    };

    img.onerror = function () {
      self.postMessage({
        type: "error",
        id: id,
        error: "Failed to load image",
      });
      URL.revokeObjectURL(blobUrl);
    };

    img.src = blobUrl;
  } catch (error) {
    self.postMessage({
      type: "error",
      id: id,
      error: error.message || "Unknown error in image processing",
    });
  }
}

// Resize an image directly (separate function for direct resize calls)
function resizeImage(data) {
  const { imageData, id, fileName, width, height, maintainAspect } = data;

  try {
    processImage({
      imageData,
      id,
      fileName,
      options: {
        resize: true,
        width,
        height,
        maintainAspect,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id: id,
      error: error.message || "Unknown error in image resizing",
    });
  }
}

// Calculate dimensions while maintaining aspect ratio if needed
function calculateDimensions(
  srcWidth,
  srcHeight,
  targetWidth,
  targetHeight,
  maintainAspect
) {
  if (!maintainAspect) {
    return { width: targetWidth, height: targetHeight };
  }

  const srcRatio = srcWidth / srcHeight;
  const targetRatio = targetWidth / targetHeight;

  let newWidth = targetWidth;
  let newHeight = targetHeight;

  if (srcRatio > targetRatio) {
    // Source image is wider
    newHeight = targetWidth / srcRatio;
  } else {
    // Source image is taller
    newWidth = targetHeight * srcRatio;
  }

  return {
    width: Math.round(newWidth),
    height: Math.round(newHeight),
  };
}

// Helper to get MIME type from filename
function getMimeType(fileName) {
  const extension = fileName.split(".").pop().toLowerCase();

  const mimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
  };

  return mimeTypes[extension] || "image/png";
}

// Process a batch of images (for better performance)
function processImageBatch(data) {
  const { images, options } = data;

  // Process each image in the batch
  images.forEach((img) => {
    processImage({
      imageData: img.imageData,
      id: img.id,
      fileName: img.fileName,
      options: options,
    });
  });
}
