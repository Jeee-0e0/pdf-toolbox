const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs';

export class PdfRenderer {
  constructor() { this.pdfDoc = null; }

  async loadDocument(arrayBuffer) {
    const typedArray = new Uint8Array(arrayBuffer);
    this.pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
    return this.pdfDoc;
  }

  get pageCount() { return this.pdfDoc ? this.pdfDoc.numPages : 0; }

  async renderPage(pageNum, scale = 1.0) {
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }

  async renderPageAtDpi(pageNum, dpi = 150) { return this.renderPage(pageNum, dpi / 72); }

  async renderThumbnail(pageNum, maxWidth = 140) {
    const page = await this.pdfDoc.getPage(pageNum);
    const defaultViewport = page.getViewport({ scale: 1.0 });
    const scale = maxWidth / defaultViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }

  canvasToImg(canvas) {
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.width = canvas.width;
    img.height = canvas.height;
    canvas.width = 0;
    canvas.height = 0;
    return img;
  }

  async getPageSize(pageNum) {
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    return { width: viewport.width, height: viewport.height };
  }

  destroy() {
    if (this.pdfDoc) { this.pdfDoc.destroy(); this.pdfDoc = null; }
  }
}