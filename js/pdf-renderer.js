// PDF.js wrapper — PDF描画・サムネイル生成
// トップレベルawaitを避け、初回loadDocument時に遅延初期化する
let pdfjsLib = null;

async function _ensurePdfjsLoaded() {
  if (pdfjsLib) return;
  pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs';
}

export class PdfRenderer {
  constructor() {
    this.pdfDoc = null;
  }

  async loadDocument(arrayBuffer) {
    await _ensurePdfjsLoaded();
    const typedArray = new Uint8Array(arrayBuffer);
    try {
      this.pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
    } catch (e) {
      if (e.name === 'PasswordException') {
        throw new Error('このPDFはパスワードで保護されています。');
      }
      throw new Error('PDFの読み込みに失敗しました。ファイルが破損している可能性があります。');
    }
    return this.pdfDoc;
  }

  get pageCount() {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  // ページをCanvasに描画して返す
  async renderPage(pageNum, scale = 1.0) {
    const page = await this.pdfDoc.getPage(pageNum); // 1-based
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // DPI指定でページを描画
  async renderPageAtDpi(pageNum, dpi = 150) {
    const scale = dpi / 72;
    return this.renderPage(pageNum, scale);
  }

  // サムネイル用（小さめスケール）
  async renderThumbnail(pageNum, maxWidth = 140) {
    const page = await this.pdfDoc.getPage(pageNum);
    const defaultViewport = page.getViewport({ scale: 1.0 });
    const scale = maxWidth / defaultViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  // CanvasをIMG要素に変換（メモリ節約）
  canvasToImg(canvas) {
    const img = document.createElement('img');
    img.src = canvas.toDataURL('image/png');
    img.width = canvas.width;
    img.height = canvas.height;
    // Canvas解放
    canvas.width = 0;
    canvas.height = 0;
    return img;
  }

  // ページのサイズ情報を取得（ポイント単位）
  async getPageSize(pageNum) {
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    return { width: viewport.width, height: viewport.height };
  }

  destroy() {
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }
  }
}
