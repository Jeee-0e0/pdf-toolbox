export class GifGenerator {
  static async _getWorkerBlobUrl() {
    if (GifGenerator._workerUrl) return GifGenerator._workerUrl;
    const response = await fetch('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');
    const blob = new Blob([await response.text()], { type: 'application/javascript' });
    GifGenerator._workerUrl = URL.createObjectURL(blob);
    return GifGenerator._workerUrl;
  }

  static async createGif(canvases, delayMs = 2000, onProgress = null) {
    const workerUrl = await GifGenerator._getWorkerBlobUrl();
    return new Promise((resolve, reject) => {
      const gif = new GIF({ workers: 2, quality: 10, workerScript: workerUrl });
      for (const canvas of canvases) gif.addFrame(canvas, { delay: delayMs, copy: true });
      gif.on('progress', p => { if (onProgress) onProgress(p); });
      gif.on('finished', blob => resolve(blob));
      gif.on('error', err => reject(err));
      gif.render();
    });
  }
}
GifGenerator._workerUrl = null;