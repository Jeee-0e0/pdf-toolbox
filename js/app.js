// メインコントローラ — ルーティング・イベント管理・全ツールのUI制御
import { PdfRenderer } from './pdf-renderer.js';
import { ThumbnailManager } from './thumbnail-manager.js';
import { PdfManipulator } from './pdf-manipulator.js';
import { DownloadHelper } from './download-helper.js';
import { GifGenerator } from './gif-generator.js';

class App {
  constructor() {
    this.renderer = new PdfRenderer();
    this.currentBuffer = null;  // 現在読み込み中のPDFのArrayBuffer
    this.currentFileName = '';
    this.mergeFiles = [];       // 結合ツール用
    this.splitPoints = new Set();
    this.deleteSet = new Set();
    this.currentTool = null;    // ツール切り替え検知用

    this._initRouting();
    this._initUploadAreas();
    this._initToolControls();
  }

  // ===== ルーティング =====
  _initRouting() {
    window.addEventListener('hashchange', () => this._route());
    this._route();
  }

  _route() {
    const hash = location.hash || '#';
    const landing = document.getElementById('landing');
    const workspaces = document.querySelectorAll('.workspace');
    const newTool = (hash && hash !== '#') ? hash.slice(1) : null;

    // ツールが変わった場合に各ツール固有の状態をリセット
    if (newTool !== this.currentTool) {
      this.mergeFiles = [];
      this.splitPoints = new Set();
      this.deleteSet = new Set();
      this.currentTool = newTool;
    }

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

  // ===== アップロードエリア =====
  _initUploadAreas() {
    document.querySelectorAll('.upload-area').forEach(area => {
      const input = area.querySelector('.file-input');
      const tool = input.dataset.tool;

      area.addEventListener('click', () => input.click());
      area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
      });
      area.addEventListener('dragleave', () => area.classList.remove('dragover'));
      area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (tool === 'merge') {
          this._handleMergeFiles(files);
        } else if (files.length > 0 && files[0].type === 'application/pdf') {
          this._handleFile(files[0], tool);
        }
      });

      input.addEventListener('change', () => {
        if (tool === 'merge') {
          this._handleMergeFiles(input.files);
        } else if (input.files.length > 0) {
          this._handleFile(input.files[0], tool);
        }
        input.value = '';
      });
    });
  }

  async _handleFile(file, tool) {
    if (file.size > 200 * 1024 * 1024) {
      alert('ファイルサイズが200MBを超えています。');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      if (!confirm('ファイルサイズが50MBを超えています。処理に時間がかかる場合があります。続行しますか？')) return;
    }

    this.currentBuffer = await file.arrayBuffer();
    this.currentFileName = file.name.replace(/\.pdf$/i, '');

    try {
      switch (tool) {
        case 'images': await this._initImagesTool(); break;
        case 'gif': await this._initGifTool(); break;
        case 'split': await this._initSplitTool(); break;
        case 'reorder': await this._initReorderTool(); break;
        case 'delete': await this._initDeleteTool(); break;
        case 'blank': await this._initBlankTool(); break;
        case 'props': await this._initPropsTool(); break;
      }
    } catch (e) {
      alert(e.message || 'PDFの読み込みに失敗しました。');
    }
  }

  // ===== ツール別コントロール初期化 =====
  _initToolControls() {
    // 画像変換
    const imgFormat = document.getElementById('images-format');
    const imgQualityRow = document.getElementById('images-quality-row');
    imgFormat?.addEventListener('change', () => {
      imgQualityRow.style.display = imgFormat.value === 'jpeg' ? '' : 'none';
    });

    const imgQuality = document.getElementById('images-quality');
    imgQuality?.addEventListener('input', () => {
      document.getElementById('images-quality-val').textContent = imgQuality.value;
    });

    const imgPages = document.getElementById('images-pages');
    imgPages?.addEventListener('change', () => {
      document.getElementById('images-page-range').style.display =
        imgPages.value === 'custom' ? '' : 'none';
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

  // ===== ユーティリティ =====
  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _showProgress(toolId, percent, text) {
    const area = document.getElementById(`${toolId}-progress`);
    if (!area) return;
    area.style.display = '';
    area.querySelector('.progress-fill').style.width = `${percent}%`;
    area.querySelector('.progress-text').textContent = text;
  }

  _hideProgress(toolId) {
    const area = document.getElementById(`${toolId}-progress`);
    if (area) area.style.display = 'none';
  }

  _parsePageRange(rangeStr, totalPages) {
    const pages = new Set();
    const parts = rangeStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end)) continue;
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          pages.add(i);
        }
      } else {
        const n = parseInt(trimmed, 10);
        if (n >= 1 && n <= totalPages) pages.add(n);
      }
    }
    return [...pages].sort((a, b) => a - b);
  }

  // ===== 1. PDF → 画像 =====
  async _initImagesTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    document.getElementById('images-controls').style.display = '';
    const preview = document.getElementById('images-preview');
    preview.innerHTML = `<div class="file-info"><span class="file-name">${this._escapeHtml(this.currentFileName)}.pdf</span><span>${this.renderer.pageCount}ページ</span></div>`;
  }

  async _convertToImages() {
    const dpi = parseInt(document.getElementById('images-dpi').value, 10);
    const format = document.getElementById('images-format').value;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = parseFloat(document.getElementById('images-quality').value);
    const ext = format === 'jpeg' ? 'jpg' : 'png';

    let pages;
    if (document.getElementById('images-pages').value === 'custom') {
      const rangeStr = document.getElementById('images-page-range').value;
      pages = this._parsePageRange(rangeStr, this.renderer.pageCount);
      if (pages.length === 0) { alert('有効なページ番号を入力してください'); return; }
    } else {
      pages = Array.from({ length: this.renderer.pageCount }, (_, i) => i + 1);
    }

    const blobs = [];
    for (let i = 0; i < pages.length; i++) {
      this._showProgress('images', (i / pages.length) * 100, `ページ ${pages[i]} / ${this.renderer.pageCount} を変換中...`);
      const canvas = await this.renderer.renderPageAtDpi(pages[i], dpi);
      const blob = await DownloadHelper.canvasToBlob(canvas, mimeType, quality);
      blobs.push(blob);
      canvas.width = 0;
      canvas.height = 0;
    }

    this._showProgress('images', 100, 'ダウンロード準備中...');

    if (blobs.length === 1) {
      DownloadHelper.downloadBlob(blobs[0], `${this.currentFileName}_p${pages[0]}.${ext}`);
    } else {
      await DownloadHelper.downloadImagesAsZip(blobs, this.currentFileName, ext, `${this.currentFileName}_images.zip`);
    }
    this._hideProgress('images');
  }

  // ===== 2. PDF → GIF =====
  async _initGifTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    document.getElementById('gif-controls').style.display = '';

    if (this.renderer.pageCount > 50) {
      alert(`このPDFは${this.renderer.pageCount}ページあります。GIF生成に時間がかかる場合があります。`);
    }

    const preview = document.getElementById('gif-preview');
    preview.innerHTML = `<div class="file-info"><span class="file-name">${this._escapeHtml(this.currentFileName)}.pdf</span><span>${this.renderer.pageCount}ページ</span></div>`;
  }

  async _convertToGif() {
    const delaySec = parseFloat(document.getElementById('gif-delay').value);
    const maxWidth = parseInt(document.getElementById('gif-width').value, 10);
    const delayMs = delaySec * 1000;
    const totalPages = this.renderer.pageCount;

    const canvases = [];
    for (let i = 1; i <= totalPages; i++) {
      this._showProgress('gif', (i / totalPages) * 40, `ページ ${i} / ${totalPages} を描画中...`);
      const canvas = await this.renderer.renderThumbnail(i, maxWidth);
      canvases.push(canvas);
    }

    this._showProgress('gif', 40, 'GIFを生成中...');

    const blob = await GifGenerator.createGif(canvases, delayMs, (p) => {
      this._showProgress('gif', 40 + p * 60, `GIFを生成中... ${Math.round(p * 100)}%`);
    });

    // Canvas解放
    canvases.forEach(c => { c.width = 0; c.height = 0; });

    this._showProgress('gif', 100, 'ダウンロード中...');
    DownloadHelper.downloadBlob(blob, `${this.currentFileName}.gif`);

    // プレビュー表示（onload後にObjectURLを解放してメモリリークを防ぐ）
    const preview = document.getElementById('gif-preview');
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(blob);
    img.src = objectUrl;
    img.style.maxWidth = '100%';
    img.onload = () => URL.revokeObjectURL(objectUrl);
    preview.innerHTML = '';
    preview.appendChild(img);

    this._hideProgress('gif');
  }

  // ===== 3. PDF 分割 =====
  async _initSplitTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    this.splitPoints = new Set();

    document.getElementById('split-controls').style.display = '';
    const preview = document.getElementById('split-preview');
    preview.innerHTML = '';

    const tm = new ThumbnailManager(this.renderer, preview);
    await tm.createThumbnails(this.renderer.pageCount, {
      insertDividers: true,
      dividerType: 'split',
      onDividerClick: (afterPage, isActive) => {
        if (isActive) this.splitPoints.add(afterPage);
        else this.splitPoints.delete(afterPage);
        this._updateSplitInfo();
      }
    });
  }

  _updateSplitInfo() {
    const count = this.splitPoints.size;
    const info = document.getElementById('split-info');
    const btn = document.getElementById('split-execute');
    if (count === 0) {
      info.textContent = '分割箇所を選択してください';
      btn.disabled = true;
    } else {
      const sorted = [...this.splitPoints].sort((a, b) => a - b);
      info.textContent = `${count + 1}つのファイルに分割: ページ ${sorted.map(p => `${p}|${p + 1}`).join(', ')} で分割`;
      btn.disabled = false;
    }
  }

  async _executeSplit() {
    if (this.splitPoints.size === 0) return;
    this._showProgress('split', 50, '分割中...');
    const sorted = [...this.splitPoints].sort((a, b) => a - b);
    const results = await PdfManipulator.splitPdf(this.currentBuffer, sorted);
    this._showProgress('split', 100, 'ダウンロード準備中...');

    if (results.length === 2) {
      results.forEach((arr, i) => DownloadHelper.downloadPdf(arr, `${this.currentFileName}_part${i + 1}.pdf`));
    } else {
      await DownloadHelper.downloadPdfsAsZip(results, this.currentFileName, `${this.currentFileName}_split.zip`);
    }
    this._hideProgress('split');
  }

  // ===== 4. PDF 結合 =====
  async _handleMergeFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type === 'application/pdf');
    if (files.length === 0) return;

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const tempRenderer = new PdfRenderer();
      await tempRenderer.loadDocument(buffer.slice(0));
      const pageCount = tempRenderer.pageCount;

      // サムネイル取得
      let thumbSrc = '';
      try {
        const canvas = await tempRenderer.renderThumbnail(1, 40);
        thumbSrc = canvas.toDataURL('image/png');
        canvas.width = 0;
        canvas.height = 0;
      } catch (e) { /* ignore */ }
      tempRenderer.destroy();

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
      item.dataset.index = index;
      item.innerHTML = `
        <span class="drag-handle">☰</span>
        ${file.thumbSrc ? `<img class="file-thumb" src="${file.thumbSrc}">` : ''}
        <span class="file-name">${this._escapeHtml(file.name)}</span>
        <span class="file-pages">${file.pageCount}ページ</span>
        <span class="remove-btn" data-index="${index}">×</span>
      `;
      list.appendChild(item);
    });

    // SortableJS
    if (this._mergeSortable) this._mergeSortable.destroy();
    this._mergeSortable = new Sortable(list, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        const [moved] = this.mergeFiles.splice(evt.oldIndex, 1);
        this.mergeFiles.splice(evt.newIndex, 0, moved);
      }
    });

    // 削除ボタン
    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        this.mergeFiles.splice(idx, 1);
        this._renderMergeList();
      });
    });
  }

  async _executeMerge() {
    if (this.mergeFiles.length < 2) {
      alert('2つ以上のPDFを追加してください');
      return;
    }
    this._showProgress('merge', 50, '結合中...');
    const buffers = this.mergeFiles.map(f => f.buffer);
    const result = await PdfManipulator.mergePdfs(buffers);
    this._showProgress('merge', 100, 'ダウンロード中...');
    DownloadHelper.downloadPdf(result, 'merged.pdf');
    this._hideProgress('merge');
  }

  // ===== 5. ページ並替 =====
  async _initReorderTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));

    document.getElementById('reorder-controls').style.display = '';
    const preview = document.getElementById('reorder-preview');
    preview.innerHTML = '';

    const tm = new ThumbnailManager(this.renderer, preview);
    await tm.createThumbnails(this.renderer.pageCount);

    // SortableJS
    if (this._reorderSortable) this._reorderSortable.destroy();
    this._reorderSortable = new Sortable(preview, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
    });
  }

  async _executeReorder() {
    const preview = document.getElementById('reorder-preview');
    const items = preview.querySelectorAll('.thumb-item');
    const newOrder = Array.from(items).map(item => parseInt(item.dataset.page, 10));

    this._showProgress('reorder', 50, 'ページを並び替え中...');
    const result = await PdfManipulator.reorderPages(this.currentBuffer, newOrder);
    this._showProgress('reorder', 100, 'ダウンロード中...');
    DownloadHelper.downloadPdf(result, `${this.currentFileName}_reordered.pdf`);
    this._hideProgress('reorder');
  }

  // ===== 6. ページ削除 =====
  async _initDeleteTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));
    this.deleteSet = new Set();

    document.getElementById('delete-controls').style.display = '';
    const preview = document.getElementById('delete-preview');
    preview.innerHTML = '';

    const tm = new ThumbnailManager(this.renderer, preview, {
      onClick: (pageNum, item) => {
        if (this.deleteSet.has(pageNum)) {
          this.deleteSet.delete(pageNum);
          item.classList.remove('selected');
        } else {
          this.deleteSet.add(pageNum);
          item.classList.add('selected');
        }
        this._updateDeleteInfo();
      }
    });
    await tm.createThumbnails(this.renderer.pageCount);
  }

  _updateDeleteInfo() {
    const count = this.deleteSet.size;
    const total = this.renderer.pageCount;
    const info = document.getElementById('delete-info');
    const btn = document.getElementById('delete-execute');

    if (count === 0) {
      info.textContent = '削除するページを選択してください';
      btn.disabled = true;
    } else {
      info.textContent = `${count}ページを削除（残り ${total - count}ページ）`;
      btn.disabled = count >= total; // 全ページ削除は不可
    }
  }

  async _executeDelete() {
    if (this.deleteSet.size === 0) return;
    const total = this.renderer.pageCount;
    if (this.deleteSet.size > total * 0.5) {
      if (!confirm(`${this.deleteSet.size}/${total}ページを削除します。よろしいですか？`)) return;
    }

    this._showProgress('delete', 50, 'ページを削除中...');
    const result = await PdfManipulator.deletePages(this.currentBuffer, [...this.deleteSet]);
    this._showProgress('delete', 100, 'ダウンロード中...');
    DownloadHelper.downloadPdf(result, `${this.currentFileName}_edited.pdf`);
    this._hideProgress('delete');
  }

  // ===== 7. 白紙ページ追加 =====
  async _initBlankTool() {
    this.renderer.destroy();
    await this.renderer.loadDocument(this.currentBuffer.slice(0));

    document.getElementById('blank-controls').style.display = '';
    const preview = document.getElementById('blank-preview');
    preview.innerHTML = '';

    this._blankTm = new ThumbnailManager(this.renderer, preview);
    await this._blankTm.createThumbnails(this.renderer.pageCount, {
      dividerType: 'blank',
      onDividerClick: (afterPage) => {
        this._blankTm.insertBlankIndicator(afterPage);
      }
    });
  }

  async _executeBlank() {
    const blanks = this._blankTm.getBlankPages();
    if (blanks.length === 0) {
      alert('白紙ページの挿入箇所を指定してください');
      return;
    }

    const sizeOption = document.getElementById('blank-size').value;

    this._showProgress('blank', 30, '白紙ページを挿入中...');

    const insertions = [];
    for (const afterPage of blanks) {
      let size;
      if (sizeOption === 'a4') {
        size = PdfManipulator.A4;
      } else if (sizeOption === 'letter') {
        size = PdfManipulator.Letter;
      } else {
        // renderer の既存ドキュメントを使用（arrayBuffer を再ロードしない）
        const targetPage = afterPage > 0 ? afterPage : 1;
        size = await this.renderer.getPageSize(targetPage);
      }
      insertions.push({ afterPage, width: size.width, height: size.height });
    }

    const result = await PdfManipulator.insertBlankPages(this.currentBuffer, insertions);
    this._showProgress('blank', 100, 'ダウンロード中...');
    DownloadHelper.downloadPdf(result, `${this.currentFileName}_with_blanks.pdf`);
    this._hideProgress('blank');
  }

  // ===== 8. プロパティ編集 =====
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
    const newTitle = document.getElementById('props-title').value;
    const result = await PdfManipulator.editTitle(this.currentBuffer, newTitle);
    DownloadHelper.downloadPdf(result, `${this.currentFileName}_edited.pdf`);
  }
}

// アプリ起動
new App();
