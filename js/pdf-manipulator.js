// pdf-lib wrapper — PDF操作（分割・結合・並替・削除・白紙挿入・メタデータ編集）
const { PDFDocument, PageSizes } = PDFLib;

export class PdfManipulator {
  // PDF分割: splitPointsは分割するページ番号の配列（1-based, そのページの後で分割）
  static async splitPdf(arrayBuffer, splitPoints) {
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = srcDoc.getPageCount();
    // 0やtotalPages以上の値は空PDFを生成するため除外
    const sortedPoints = [...new Set(splitPoints)]
      .filter(p => p > 0 && p < totalPages)
      .sort((a, b) => a - b);

    const ranges = [];
    let start = 0;
    for (const point of sortedPoints) {
      ranges.push([start, point - 1]); // 0-based
      start = point; // 0-based
    }
    ranges.push([start, totalPages - 1]);

    const results = [];
    for (const [rangeStart, rangeEnd] of ranges) {
      const newDoc = await PDFDocument.create();
      const indices = [];
      for (let i = rangeStart; i <= rangeEnd; i++) indices.push(i);
      const pages = await newDoc.copyPages(srcDoc, indices);
      pages.forEach(page => newDoc.addPage(page));
      const bytes = await newDoc.save();
      results.push(bytes);
    }
    return results;
  }

  // PDF結合: arrayBuffersは結合するPDFのArrayBuffer配列（順序通り）
  static async mergePdfs(arrayBuffers) {
    const mergedDoc = await PDFDocument.create();
    for (const buffer of arrayBuffers) {
      const srcDoc = await PDFDocument.load(buffer);
      const indices = srcDoc.getPageIndices();
      const pages = await mergedDoc.copyPages(srcDoc, indices);
      pages.forEach(page => mergedDoc.addPage(page));
    }
    return mergedDoc.save();
  }

  // ページ並替: newOrderは新しいページ順の配列（1-based）
  static async reorderPages(arrayBuffer, newOrder) {
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const newDoc = await PDFDocument.create();
    const indices = newOrder.map(n => n - 1); // 0-based
    const pages = await newDoc.copyPages(srcDoc, indices);
    pages.forEach(page => newDoc.addPage(page));
    return newDoc.save();
  }

  // ページ削除: deleteIndicesは削除するページ番号の配列（1-based）
  static async deletePages(arrayBuffer, deleteIndices) {
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = srcDoc.getPageCount();
    const deleteSet = new Set(deleteIndices.map(n => n - 1)); // 0-based
    const keepIndices = [];
    for (let i = 0; i < totalPages; i++) {
      if (!deleteSet.has(i)) keepIndices.push(i);
    }
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, keepIndices);
    pages.forEach(page => newDoc.addPage(page));
    return newDoc.save();
  }

  // 白紙ページ挿入: insertionsは{afterPage, width, height}の配列（afterPageは1-based, 0=先頭）
  static async insertBlankPages(arrayBuffer, insertions) {
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const newDoc = await PDFDocument.create();
    const totalPages = srcDoc.getPageCount();

    // afterPageでグループ化（降順にならないようソート）
    const insertMap = new Map();
    for (const ins of insertions) {
      if (!insertMap.has(ins.afterPage)) insertMap.set(ins.afterPage, []);
      insertMap.get(ins.afterPage).push(ins);
    }

    // 先頭に白紙を挿入
    if (insertMap.has(0)) {
      for (const ins of insertMap.get(0)) {
        newDoc.addPage([ins.width, ins.height]);
      }
    }

    // 各ページをコピーし、その後に白紙を挿入
    for (let i = 0; i < totalPages; i++) {
      const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(copiedPage);
      const pageNum = i + 1; // 1-based
      if (insertMap.has(pageNum)) {
        for (const ins of insertMap.get(pageNum)) {
          newDoc.addPage([ins.width, ins.height]);
        }
      }
    }

    return newDoc.save();
  }

  // メタデータ読み取り
  static async getMetadata(arrayBuffer) {
    const doc = await PDFDocument.load(arrayBuffer);
    return {
      title: doc.getTitle() || '',
      author: doc.getAuthor() || '',
      subject: doc.getSubject() || '',
      creator: doc.getCreator() || '',
      pageCount: doc.getPageCount(),
    };
  }

  // タイトル編集
  static async editTitle(arrayBuffer, newTitle) {
    const doc = await PDFDocument.load(arrayBuffer);
    doc.setTitle(newTitle);
    return doc.save();
  }

  // ページサイズ取得（0-based index）
  static async getPageSize(arrayBuffer, pageIndex) {
    const doc = await PDFDocument.load(arrayBuffer);
    const page = doc.getPage(pageIndex);
    const { width, height } = page.getSize();
    return { width, height };
  }

  // A4サイズ（ポイント）
  static get A4() {
    return { width: 595.28, height: 841.89 };
  }

  // Letterサイズ（ポイント）
  static get Letter() {
    return { width: 612, height: 792 };
  }
}
