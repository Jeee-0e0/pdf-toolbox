// GIF生成ラッパー — gif.jsを使用
export class GifGenerator {
  // gif.jsのWorker CORS問題を回避するためにBlob URLを生成
  static async _getWorkerBlobUrl() {
    if (GifGenerator._workerUrl) return GifGenerator._workerUrl;
    try {
      const response = await fetch('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');
      const text = await response.text();
      const blob = new Blob([text], { type: 'application/javascript' });
      GifGenerator._workerUrl = URL.createObjectURL(blob);
      return GifGenerator._workerUrl;
    } catch (e) {
      console.error('Failed to load gif.js worker:', e);
      throw e;
    }
  }

  // CanvasからGIFを生成
  // canvases: Canvas要素の配列
  // delayMs: 1フレームあたりのミリ秒
  // onProgress: (progress: 0-1) => void
  static async createGif(canvases, delayMs = 2000, onProgress = null) {
    const workerUrl = await GifGenerator._getWorkerBlobUrl();

    return new Promise((resolve, reject) => {
      const gif = new GIF({
        workers: 2,
        quality: 10, // gif.js の quality はサンプリング間隔（低いほど高品質・低速、高いほど低品質・高速）
        workerScript: workerUrl,
      });

      for (const canvas of canvases) {
        gif.addFrame(canvas, { delay: delayMs, copy: true });
      }

      gif.on('progress', (p) => {
        if (onProgress) onProgress(p);
      });

      gif.on('finished', (blob) => {
        resolve(blob);
      });

      gif.on('error', (err) => {
        reject(err);
      });

      gif.render();
    });
  }
}

GifGenerator._workerUrl = null;

// ページアンロード時などにワーカーURLを解放する場合は呼び出す
GifGenerator.destroyWorker = function () {
  if (GifGenerator._workerUrl) {
    URL.revokeObjectURL(GifGenerator._workerUrl);
    GifGenerator._workerUrl = null;
  }
};
