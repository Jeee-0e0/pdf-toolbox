// サムネイル遅延読み込みマネージャー（IntersectionObserver）
export class ThumbnailManager {
  constructor(renderer, container, options = {}) {
    this.renderer = renderer;
    this.container = container;
    this.maxWidth = options.maxWidth || 140;
    this.onThumbnailClick = options.onClick || null;
    this.observer = null;
    this.items = [];
  }

  // プレースホルダーを生成し、IntersectionObserverで遅延描画
  async createThumbnails(pageCount, options = {}) {
    this.clear();
    const { insertDividers, dividerType, onDividerClick } = options;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const pageNum = parseInt(el.dataset.page, 10);
          if (!el.dataset.rendered) {
            this._renderThumbnail(el, pageNum);
          }
          this.observer.unobserve(el);
        }
      });
    }, { rootMargin: '200px' });

    // 先頭の挿入ボタン（blankツール用）
    if (dividerType === 'blank') {
      const btn = this._createInsertBtn(0, onDividerClick);
      this.container.appendChild(btn);
    }

    for (let i = 1; i <= pageCount; i++) {
      const item = this._createPlaceholder(i);
      this.container.appendChild(item);
      this.observer.observe(item);
      this.items.push(item);

      // ページ間のUI要素
      if (i < pageCount || dividerType === 'blank') {
        if (insertDividers && dividerType === 'split') {
          const divider = this._createSplitDivider(i, onDividerClick);
          this.container.appendChild(divider);
        } else if (dividerType === 'blank') {
          const btn = this._createInsertBtn(i, onDividerClick);
          this.container.appendChild(btn);
        }
      }
    }
  }

  _createPlaceholder(pageNum) {
    const item = document.createElement('div');
    item.className = 'thumb-item';
    item.dataset.page = pageNum;

    const placeholder = document.createElement('div');
    placeholder.className = 'thumb-placeholder';
    placeholder.textContent = pageNum;
    item.appendChild(placeholder);

    const label = document.createElement('div');
    label.className = 'thumb-label';
    label.textContent = `${pageNum}`;
    item.appendChild(label);

    if (this.onThumbnailClick) {
      item.addEventListener('click', () => this.onThumbnailClick(pageNum, item));
    }

    return item;
  }

  async _renderThumbnail(el, pageNum) {
    // pending をセットしてから await するため、同一要素への二重描画を防ぐ
    el.dataset.rendered = 'pending';
    try {
      const canvas = await this.renderer.renderThumbnail(pageNum, this.maxWidth);
      const img = this.renderer.canvasToImg(canvas);
      const placeholder = el.querySelector('.thumb-placeholder');
      if (placeholder) {
        el.replaceChild(img, placeholder);
      }
      el.dataset.rendered = 'true';
    } catch (e) {
      el.dataset.rendered = ''; // エラー時はリセットして再試行を許可
      console.error(`Thumbnail render failed for page ${pageNum}:`, e);
    }
  }

  _createSplitDivider(afterPage, onClick) {
    const divider = document.createElement('div');
    divider.className = 'split-divider';
    divider.dataset.afterPage = afterPage;
    divider.title = `ページ ${afterPage} と ${afterPage + 1} の間で分割`;
    divider.addEventListener('click', () => {
      divider.classList.toggle('active');
      if (onClick) onClick(afterPage, divider.classList.contains('active'));
    });
    return divider;
  }

  _createInsertBtn(afterPage, onClick) {
    const btn = document.createElement('div');
    btn.className = 'blank-insert-btn';
    btn.dataset.afterPage = afterPage;
    btn.textContent = '+';
    btn.title = afterPage === 0
      ? '先頭に白紙ページを挿入'
      : `ページ ${afterPage} の後に白紙ページを挿入`;
    btn.addEventListener('click', () => {
      if (onClick) onClick(afterPage);
    });
    return btn;
  }

  // 白紙ページのプレースホルダーを追加
  insertBlankIndicator(afterPage) {
    const items = Array.from(this.container.children);
    let targetIndex = -1;

    // afterPageの後のinsertボタンの次に挿入
    for (let i = 0; i < items.length; i++) {
      if (items[i].classList.contains('blank-insert-btn') &&
          parseInt(items[i].dataset.afterPage, 10) === afterPage) {
        targetIndex = i;
        break;
      }
    }

    const blankItem = document.createElement('div');
    blankItem.className = 'thumb-item blank-page';
    blankItem.dataset.isBlank = 'true';
    blankItem.dataset.afterPage = afterPage;

    const placeholder = document.createElement('div');
    placeholder.className = 'thumb-placeholder';
    placeholder.textContent = '白紙';
    blankItem.appendChild(placeholder);

    const label = document.createElement('div');
    label.className = 'thumb-label';
    label.textContent = '白紙';
    blankItem.appendChild(label);

    // クリックで削除
    blankItem.addEventListener('click', () => {
      blankItem.remove();
    });

    if (targetIndex >= 0 && targetIndex + 1 < items.length) {
      this.container.insertBefore(blankItem, items[targetIndex + 1]);
    } else {
      this.container.appendChild(blankItem);
    }

    return blankItem;
  }

  // 挿入された白紙ページの情報を取得
  getBlankPages() {
    const blanks = this.container.querySelectorAll('.thumb-item.blank-page');
    return Array.from(blanks).map(el => parseInt(el.dataset.afterPage, 10));
  }

  clear() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.container.innerHTML = '';
    this.items = [];
  }
}
