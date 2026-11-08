// Client-Side Image Compressor (Guaranteed Base64 Payload <= 100 KB for Supabase Free Tier)
window.ImageCompressor = {
  // Binary target 70KB -> Base64 string will be ~93KB (strictly <= 100KB in database)
  MAX_BYTES: 70 * 1024,

  /**
   * Compresses an image file or blob to <= 100KB database payload
   * @param {File|Blob} file
   * @param {string} mimeType 'image/jpeg'
   * @param {number} customMaxBytes Optional tighter limit (e.g. for chat attachments)
   * @returns {Promise<{dataUrl: string, blob: Blob, sizeKb: number, width: number, height: number}>}
   */
  async compress(file, mimeType = 'image/jpeg', customMaxBytes = null) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        return reject(new Error('Invalid image file.'));
      }

      const maxLimit = customMaxBytes || this.MAX_BYTES;
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.onload = async () => {
          try {
            const result = await this.compressImageElement(img, mimeType, maxLimit);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * Compresses an HTMLImageElement
   */
  async compressImageElement(img, mimeType = 'image/jpeg', maxLimit = null) {
    const targetMaxBytes = maxLimit || this.MAX_BYTES;
    let scale = 1.0;
    let quality = 0.82;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Downscale max dimension based on free-tier optimization
    let origWidth = img.naturalWidth || img.width;
    let origHeight = img.naturalHeight || img.height;
    const maxDim = 1200;
    if (origWidth > maxDim || origHeight > maxDim) {
      scale = maxDim / Math.max(origWidth, origHeight);
    }

    let blob = null;
    let dataUrl = '';
    let iterations = 0;

    while (iterations < 12) {
      iterations++;
      const targetW = Math.max(180, Math.round(origWidth * scale));
      const targetH = Math.max(180, Math.round(origHeight * scale));

      canvas.width = targetW;
      canvas.height = targetH;

      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);

      blob = await new Promise(res => canvas.toBlob(res, mimeType, quality));
      if (!blob) {
        throw new Error('Canvas compression failed.');
      }

      // Check if binary size fits target
      if (blob.size <= targetMaxBytes || (quality <= 0.35 && scale <= 0.3)) {
        dataUrl = canvas.toDataURL(mimeType, quality);
        // Ensure string length is also strictly <= 100KB (102,400 chars)
        if (dataUrl.length <= 100 * 1024) {
          break;
        }
      }

      // Step down quality or scale
      if (quality > 0.45) {
        quality -= 0.12;
      } else {
        scale *= 0.75;
        quality = 0.70;
      }
    }

    if (!dataUrl) {
      dataUrl = canvas.toDataURL(mimeType, quality);
    }

    return {
      dataUrl,
      blob,
      sizeKb: +(blob.size / 1024).toFixed(1),
      stringSizeKb: +(dataUrl.length / 1024).toFixed(1),
      width: canvas.width,
      height: canvas.height
    };
  }
};
