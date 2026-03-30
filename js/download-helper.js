export class DownloadHelper {
  static downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static downloadPdf(uint8Array, filename) {
    DownloadHelper.downloadBlob(new Blob([uint8Array], { type: 'application/pdf' }), filename);
  }

  static canvasToBlob(canvas, format = 'image/png', quality = 0.9) {
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), format, quality));
  }

  static async downloadImagesAsZip(blobs, baseName, ext, zipFilename) {
    const zip = new JSZip();
    blobs.forEach((blob, i) => zip.file(`${baseName}_${String(i + 1).padStart(3, '0')}.${ext}`, blob));
    DownloadHelper.downloadBlob(await zip.generateAsync({ type: 'blob' }), zipFilename);
  }

  static async downloadPdfsAsZip(pdfArrays, baseName, zipFilename) {
    const zip = new JSZip();
    pdfArrays.forEach((arr, i) => zip.file(`${baseName}_part${i + 1}.pdf`, arr));
    DownloadHelper.downloadBlob(await zip.generateAsync({ type: 'blob' }), zipFilename);
  }
}