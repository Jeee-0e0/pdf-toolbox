const { PDFDocument } = PDFLib;

export class PdfManipulator {
  static async splitPdf(arrayBuffer, splitPoints) {
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = srcDoc.getPageCount();
    const sortedPoints = [...new Set(splitPoints)].sort((a, b) => a - b);
    const ranges = [];
    let start = 0;
    for (const point of sortedPoints) { ranges.push([start, point - 1]); start = point; }
    ranges.push([start, totalPages - 1]);
    const results = [];
    for (const [s, e] of ranges) {
      const newDoc = await PDFDocument.create();
      const indices = [];
      for (let i = s; i <= e; i++) indices.push(i);
      const pages = await newDoc.copyPages(srcDoc, indices);
      pages.forEach(p => newDoc.addPage(p));
      results.push(await newDoc.save());
    }
    return results;
  }

  static async mergePdfs(arrayBuffers) {
    const mergedDoc = await PDFDocument.create();
    for (const buffer of arrayBuffers) {
      const srcDoc = await PDFDocument.load(buffer);
      const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach(p => mergedDoc.addPage(p));
    }
    return mergedDoc.save();
  }

  static async reorderPages(arrayBuffer, newOrder) {
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, newOrder.map(n => n - 1));
    pages.forEach(p => newDoc.addPage(p));
    return newDoc.save();
  }

  static async deletePages(arrayBuffer, deleteIndices) {
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const deleteSet = new Set(deleteIndices.map(n => n - 1));
    const keepIndices = [...Array(srcDoc.getPageCount()).keys()].filter(i => !deleteSet.has(i));
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(srcDoc, keepIndices);
    pages.forEach(p => newDoc.addPage(p));
    return newDoc.save();
  }

  static async insertBlankPages(arrayBuffer, insertions) {
    const srcDoc = await PDFDocument.load(arrayBuffer);
    const newDoc = await PDFDocument.create();
    const totalPages = srcDoc.getPageCount();
    const insertMap = new Map();
    for (const ins of insertions) {
      if (!insertMap.has(ins.afterPage)) insertMap.set(ins.afterPage, []);
      insertMap.get(ins.afterPage).push(ins);
    }
    if (insertMap.has(0)) for (const ins of insertMap.get(0)) newDoc.addPage([ins.width, ins.height]);
    for (let i = 0; i < totalPages; i++) {
      const [p] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(p);
      if (insertMap.has(i + 1)) for (const ins of insertMap.get(i + 1)) newDoc.addPage([ins.width, ins.height]);
    }
    return newDoc.save();
  }

  static async getMetadata(arrayBuffer) {
    const doc = await PDFDocument.load(arrayBuffer);
    return { title: doc.getTitle() || '', author: doc.getAuthor() || '', subject: doc.getSubject() || '', creator: doc.getCreator() || '', pageCount: doc.getPageCount() };
  }

  static async editTitle(arrayBuffer, newTitle) {
    const doc = await PDFDocument.load(arrayBuffer);
    doc.setTitle(newTitle);
    return doc.save();
  }

  static async getPageSize(arrayBuffer, pageIndex) {
    const doc = await PDFDocument.load(arrayBuffer);
    const { width, height } = doc.getPage(pageIndex).getSize();
    return { width, height };
  }

  static get A4() { return { width: 595.28, height: 841.89 }; }
  static get Letter() { return { width: 612, height: 792 }; }
}