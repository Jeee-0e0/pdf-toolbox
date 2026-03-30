// ダウンロードヘルパー — Blob/ZIPダウンロード
export class DownloadHelper {
  // 単一ファイルダウンロード
  static downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // click()直後の即時revokeはダウンロード開始前にURLが消える場合があるため遅延解放
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  // Uint8ArrayをPDFとしてダウンロード
  static downloadPdf(uint8Array, filename) {
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    DownloadHelper.downloadBlob(blob, filename);
  }

  // 複数ファイルをZIPにまとめてダウンロード
  static async downloadAsZip(files, zipFilename) {
    const zip = new JSZip();
    for (const { data, filename } of files) {
      zip.file(filename, data);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    DownloadHelper.downloadBlob(content, zipFilename);
  }

  // CanvasをBlobに変換
  static canvasToBlob(canvas, format = 'image/png', quality = 0.9) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob === null) {
          reject(new Error('Canvas to Blob の変換に失敗しました。'));
        } else {
          resolve(blob);
        }
      }, format, quality);
    });
  }

  // 複数の画像BlobをZIPにまとめてダウンロード
  static async downloadImagesAsZip(blobs, baseName, ext, zipFilename) {
    const zip = new JSZip();
    blobs.forEach((blob, i) => {
      zip.file(`${baseName}_${String(i + 1).padStart(3, '0')}.${ext}`, blob);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    DownloadHelper.downloadBlob(content, zipFilename);
  }

  // 複数のPDFをZIPにまとめてダウンロード
  static async downloadPdfsAsZip(pdfArrays, baseName, zipFilename) {
    const zip = new JSZip();
    pdfArrays.forEach((arr, i) => {
      zip.file(`${baseName}_part${i + 1}.pdf`, arr);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    DownloadHelper.downloadBlob(content, zipFilename);
  }
}
