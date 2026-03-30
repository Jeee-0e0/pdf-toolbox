import { PdfRenderer } from './pdf-renderer.js';
import { ThumbnailManager } from './thumbnail-manager.js';
import { PdfManipulator } from './pdf-manipulator.js';
import { DownloadHelper } from './download-helper.js';
import { GifGenerator } from './gif-generator.js';

class App {
  constructor() {
    this.renderer = new PdfRenderer();
    this.currentBuffer = null;
    this.currentFileName = '';
    this.mergeFiles = [];
    this.splitPoints = new Set();
    this.deleteSet = new Set();
    this._initRouting();
    this._initUploadAreas();
    this._initToolControls();
  }

  _initRouting() {
    window.addEventListener('hashchange', () => this._route());
    this._route();
  }

  _route() {
    const hash = location.hash || '#';
    const landing = document.getElementById('landing');
    const workspaces = document.querySelectorAll('.workspace');
    if (hash === '#' || hash === '') {
      landing.style.display = '';
      workspaces.forEach(ws => ws.classList.add('hidden'));
      return;
    }
    const target = document.getElementById(hash.slice(1));
    if (target && target.classList.contains('workspace')) {
      landing.style.display = 'none';
      workspaces.forEach(ws => ws.classList.add('hidden'));
      target.classList.remove('hidden');
    }
  }

  _initUploadAreas() {
    document.querySelectorAll('.upload-area').forEach(area => {
      const input = area.querySelector('.file-input');
      const tool = input.dataset.tool;
      area.addEventListener('click', () => input.click());
      area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
      area.addEventListener('dragleave', () => area.classList.remove('dragover'));
      area.addEventListener('drop', e => {
        e.preventDefault(); area.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (tool === 'merge') this._handleMergeFiles(files);
        else if (files.length > 0 && files[0].type === 'application/pdf') this._handleFile(files[0], tool);
      });
      input.addEventListener('change', () => {
        if (tool === 'merge') this._handleMergeFiles(input.files);
        else if (input.files.length > 0) this._handleFile(input.files[0], tool);
        input.value = '';
      });
    });
  }

  async _handleFile(file, tool) {
    if (file.size > 200 * 1024 * 1024) { alert('ファイルサイズが200MBを超えています。'); return; }
    if (file.size > 50 * 1024 * 1024 && !confirm('ファイルサイズが50MBを超えています。続行しますか？')) return;
    this.currentBuffer = await file.arrayBuffer();
    this.currentFileName = file.name.replace(/\.pdf$/i, '');
    const map = { images: '_initImagesTool', gif: '_initGifTool', split: '_initSplitTool', reorder: '_initReorderTool', delete: '_initDeleteTool', blank: '_initBlankTool', props: '_initPropsTool' };
    if (map[tool]) await this[map[tool]]();
  }

  _initToolControls() {
    const imgFormat = document.getElementById('images-format');
    imgFormat?.addEventListener('change', () => {
      document.getElementById('images-quality-row').style.display = imgFormat.value === 'jpeg' ? '' : 'none';
    });
    const imgQuality = document.getElementById('images-quality');
    imgQuality?.addEventListener('input', () => { document.getElementById('images-quality-val').textContent = imgQuality.value; });
    const imgPages = document.getElementById('images-pages');
    imgPages?.addEventListener('change', () => {
      document.getElementById('images-page-range').style.display = imgPages.value === 'custom' ? '' : 'none';
    });
    document.getElementById('images-convert')?.addEventListener('click', () => this._convertToImages());
    document.getElementById('gif-convert')?.addEventListener('click', () => this._convertToGif());
    document.getElementById('split-execute')?.addEventListener('click', () => this._executeSplit());
    document.getElementById('merge-execute')?.addEventListener('click', () => this._executeMerge());
    document.getElementById('reorder-execute')?.addEventListener('click', () => this._executeReorder());
    document.getElementById('delete-execute')?.addEventListener('click', () => this._executeDelete());
    document.getElementById('blank-execute')?.addEventListener('click', () => this._executeBlank());
    document.getElementById('props-execute')?.addEventListener('click', () => this._executeProps());
  }

  _showProgress(id, pct, text) {
    const area = document.getElementById(`${id}-progress`);
    area.style.display = '';
    area.querySelector('.progress-fill').style.width = `${pct}%`;
    area.querySelector('.progress-text').textContent = text;
  }

  _hideProgress(id) {
    const area = document.getElementById(`${id}-progress`);
    if (area) area.style.display = 'none';
  }

  _parsePageRange(rangeStr, total) {
    const pages = new Set();
    for (const part of rangeStr.split(',')) {
      const t = part.trim();
      if (t.includes('-')) {
        const [s, e] = t.split('-').map(Number);
        for (let i = Math.max(1, s); i <= Math.min(total, e); i++) pages.add(i);
      } else {
        const n = parseInt(t, 10);
        if (n >= 1 && n <= total) pages.add(n);
      }
    }
    return [...pages].sort((a, b) => a - b);
  }

  async _initImagesTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    document.getElementById('images-controls').style.display = '';
    document.getElementById('images-preview').innerHTML = `<div class="file-info"><span class="file-name">${this.currentFileName}.pdf</span><span>${this.renderer.pageCount}ページ</span></div>`;
  }

  async _convertToImages() {
    const dpi = parseInt(document.getElementById('images-dpi').value, 10);
    const format = document.getElementById('images-format').value;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = parseFloat(document.getElementById('images-quality').value);
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    let pages;
    if (document.getElementById('images-pages').value === 'custom') {
      pages = this._parsePageRange(document.getElementById('images-page-range').value, this.renderer.pageCount);
      if (!pages.length) { alert('有効なページ番号を入力してください'); return; }
    } else {
      pages = Array.from({ length: this.renderer.pageCount }, (_, i) => i + 1);
    }
    const blobs = [];
    for (let i = 0; i < pages.length; i++) {
      this._showProgress('images', (i / pages.length) * 100, `ページ ${pages[i]} / ${this.renderer.pageCount} を変換中...`);
      const canvas = await this.renderer.renderPageAtDpi(pages[i], dpi);
      blobs.push(await DownloadHelper.canvasToBlob(canvas, mimeType, quality));
      canvas.width = 0; canvas.height = 0;
    }
    this._showProgress('images', 100, 'ダウンロード準備中...');
    if (blobs.length === 1) DownloadHelper.downloadBlob(blobs[0], `${this.currentFileName}_p${pages[0]}.${ext}`);
    else await DownloadHelper.downloadImagesAsZip(blobs, this.currentFileName, ext, `${this.currentFileName}_images.zip`);
    this._hideProgress('images');
  }

  async _initGifTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    document.getElementById('gif-controls').style.display = '';
    if (this.renderer.pageCount > 50) alert(`${this.renderer.pageCount}ページのPDFです。GIF生成に時間がかかる場合があります。`);
    document.getElementById('gif-preview').innerHTML = `<div class="file-info"><span class="file-name">${this.currentFileName}.pdf</span><span>${this.renderer.pageCount}ページ</span></div>`;
  }

  async _convertToGif() {
    const delayMs = parseFloat(document.getElementById('gif-delay').value) * 1000;
    const maxWidth = parseInt(document.getElementById('gif-width').value, 10);
    const total = this.renderer.pageCount;
    const canvases = [];
    for (let i = 1; i <= total; i++) {
      this._showProgress('gif', (i / total) * 40, `ページ ${i} / ${total} を描画中...`);
      canvases.push(await this.renderer.renderThumbnail(i, maxWidth));
    }
    const blob = await GifGenerator.createGif(canvases, delayMs, p => this._showProgress('gif', 40 + p * 60, `GIFを生成中... ${Math.round(p * 100)}%`));
    canvases.forEach(c => { c.width = 0; c.height = 0; });
    DownloadHelper.downloadBlob(blob, `${this.currentFileName}.gif`);
    const preview = document.getElementById('gif-preview');
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    preview.innerHTML = ''; preview.appendChild(img);
    this._hideProgress('gif');
  }

  async _initSplitTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    this.splitPoints = new Set();
    document.getElementById('split-controls').style.display = '';
    const preview = document.getElementById('split-preview');
    preview.innerHTML = '';
    const tm = new ThumbnailManager(this.renderer, preview);
    await tm.createThumbnails(this.renderer.pageCount, {
      insertDividers: true, dividerType: 'split',
      onDividerClick: (afterPage, isActive) => {
        if (isActive) this.splitPoints.add(afterPage); else this.splitPoints.delete(afterPage);
        this._updateSplitInfo();
      }
    });
  }

  _updateSplitInfo() {
    const count = this.splitPoints.size;
    const info = document.getElementById('split-info');
    const btn = document.getElementById('split-execute');
    if (count === 0) { info.textContent = '分割箇所を選択してください'; btn.disabled = true; }
    else { const sorted = [...this.splitPoints].sort((a,b)=>a-b); info.textContent = `${count+1}つのファイルに分割: ${sorted.map(p=>`${p}|${p+1}`).join(', ')} で分割`; btn.disabled = false; }
  }

  async _executeSplit() {
    if (!this.splitPoints.size) return;
    this._showProgress('split', 50, '分割中...');
    const results = await PdfManipulator.splitPdf(this.currentBuffer, [...this.splitPoints].sort((a,b)=>a-b));
    this._showProgress('split', 100, 'ダウンロード準備中...');
    if (results.length === 2) results.forEach((arr, i) => DownloadHelper.downloadPdf(arr, `${this.currentFileName}_part${i+1}.pdf`));
    else await DownloadHelper.downloadPdfsAsZip(results, this.currentFileName, `${this.currentFileName}_split.zip`);
    this._hideProgress('split');
  }

  async _handleMergeFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type === 'application/pdf');
    if (!files.length) return;
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const r = new PdfRenderer();
      await r.loadDocument(buffer.slice(0));
      const pageCount = r.pageCount;
      let thumbSrc = '';
      try { const c = await r.renderThumbnail(1, 40); thumbSrc = c.toDataURL(); c.width = 0; c.height = 0; } catch(e){}
      r.destroy();
      this.mergeFiles.push({ name: file.name, buffer, pageCount, thumbSrc });
    }
    document.getElementById('merge-controls').style.display = '';
    this._renderMergeList();
  }

  _renderMergeList() {
    const list = document.getElementById('merge-file-list');
    list.innerHTML = '';
    this.mergeFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'merge-file-item';
      item.innerHTML = `<span class="drag-handle">☰</span>${file.thumbSrc ? `<img class="file-thumb" src="${file.thumbSrc}">` : ''}<span class="file-name">${file.name}</span><span class="file-pages">${file.pageCount}ページ</span><span class="remove-btn" data-index="${index}">×</span>`;
      list.appendChild(item);
    });
    if (this._mergeSortable) this._mergeSortable.destroy();
    this._mergeSortable = new Sortable(list, { handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost', onEnd: evt => { const [m] = this.mergeFiles.splice(evt.oldIndex, 1); this.mergeFiles.splice(evt.newIndex, 0, m); } });
    list.querySelectorAll('.remove-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); this.mergeFiles.splice(parseInt(btn.dataset.index,10),1); this._renderMergeList(); }));
  }

  async _executeMerge() {
    if (this.mergeFiles.length < 2) { alert('2つ以上のPDFを追加してください'); return; }
    this._showProgress('merge', 50, '結合中...');
    DownloadHelper.downloadPdf(await PdfManipulator.mergePdfs(this.mergeFiles.map(f=>f.buffer)), 'merged.pdf');
    this._hideProgress('merge');
  }

  async _initReorderTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    document.getElementById('reorder-controls').style.display = '';
    const preview = document.getElementById('reorder-preview');
    preview.innerHTML = '';
    await new ThumbnailManager(this.renderer, preview).createThumbnails(this.renderer.pageCount);
    if (this._reorderSortable) this._reorderSortable.destroy();
    this._reorderSortable = new Sortable(preview, { animation: 150, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen' });
  }

  async _executeReorder() {
    const newOrder = Array.from(document.getElementById('reorder-preview').querySelectorAll('.thumb-item')).map(el => parseInt(el.dataset.page, 10));
    this._showProgress('reorder', 50, 'ページを並び替え中...');
    DownloadHelper.downloadPdf(await PdfManipulator.reorderPages(this.currentBuffer, newOrder), `${this.currentFileName}_reordered.pdf`);
    this._hideProgress('reorder');
  }

  async _initDeleteTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    this.deleteSet = new Set();
    document.getElementById('delete-controls').style.display = '';
    const preview = document.getElementById('delete-preview');
    preview.innerHTML = '';
    await new ThumbnailManager(this.renderer, preview, {
      onClick: (pageNum, item) => {
        if (this.deleteSet.has(pageNum)) { this.deleteSet.delete(pageNum); item.classList.remove('selected'); }
        else { this.deleteSet.add(pageNum); item.classList.add('selected'); }
        this._updateDeleteInfo();
      }
    }).createThumbnails(this.renderer.pageCount);
  }

  _updateDeleteInfo() {
    const count = this.deleteSet.size, total = this.renderer.pageCount;
    const info = document.getElementById('delete-info'), btn = document.getElementById('delete-execute');
    if (count === 0) { info.textContent = '削除するページを選択してください'; btn.disabled = true; }
    else { info.textContent = `${count}ページを削除（残り ${total-count}ページ）`; btn.disabled = count >= total; }
  }

  async _executeDelete() {
    if (!this.deleteSet.size) return;
    if (this.deleteSet.size > this.renderer.pageCount * 0.5 && !confirm(`${this.deleteSet.size}/${this.renderer.pageCount}ページを削除します。よろしいですか？`)) return;
    this._showProgress('delete', 50, 'ページを削除中...');
    DownloadHelper.downloadPdf(await PdfManipulator.deletePages(this.currentBuffer, [...this.deleteSet]), `${this.currentFileName}_edited.pdf`);
    this._hideProgress('delete');
  }

  async _initBlankTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    document.getElementById('blank-controls').style.display = '';
    const preview = document.getElementById('blank-preview');
    preview.innerHTML = '';
    this._blankTm = new ThumbnailManager(this.renderer, preview);
    await this._blankTm.createThumbnails(this.renderer.pageCount, { dividerType: 'blank', onDividerClick: afterPage => this._blankTm.insertBlankIndicator(afterPage) });
  }

  async _executeBlank() {
    const blanks = this._blankTm.getBlankPages();
    if (!blanks.length) { alert('白紙ページの挿入箇所を指定してください'); return; }
    const sizeOption = document.getElementById('blank-size').value;
    const insertions = [];
    for (const afterPage of blanks) {
      let size;
      if (sizeOption === 'a4') size = PdfManipulator.A4;
      else if (sizeOption === 'letter') size = PdfManipulator.Letter;
      else size = await PdfManipulator.getPageSize(this.currentBuffer, afterPage > 0 ? afterPage - 1 : 0);
      insertions.push({ afterPage, ...size });
    }
    this._showProgress('blank', 50, '白紙ページを挿入中...');
    DownloadHelper.downloadPdf(await PdfManipulator.insertBlankPages(this.currentBuffer, insertions), `${this.currentFileName}_with_blanks.pdf`);
    this._hideProgress('blank');
  }

  async _initPropsTool() {
    const meta = await PdfManipulator.getMetadata(this.currentBuffer);
    document.getElementById('props-controls').style.display = '';
    document.getElementById('props-title').value = meta.title;
    document.getElementById('props-author').value = meta.author;
    document.getElementById('props-subject').value = meta.subject;
    document.getElementById('props-creator').value = meta.creator;
    document.getElementById('props-pages').value = `${meta.pageCount}ページ`;
  }

  async _executeProps() {
    DownloadHelper.downloadPdf(await PdfManipulator.editTitle(this.currentBuffer, document.getElementById('props-title').value), `${this.currentFileName}_edited.pdf`);
  }
}

new App();