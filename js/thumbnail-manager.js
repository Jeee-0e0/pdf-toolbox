export class ThumbnailManager {
  constructor(renderer, container, options = {}) {
    this.renderer = renderer;
    this.container = container;
    this.maxWidth = options.maxWidth || 140;
    this.onThumbnailClick = options.onClick || null;
    this.observer = null;
    this.items = [];
  }

  async createThumbnails(pageCount, options = {}) {
    this.clear();
    const { insertDividers, dividerType, onDividerClick } = options;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const pageNum = parseInt(el.dataset.page, 10);
          if (!el.dataset.rendered) this._renderThumbnail(el, pageNum);
          this.observer.unobserve(el);
        }
      });
    }, { rootMargin: '200px' });

    if (dividerType === 'blank') this.container.appendChild(this._createInsertBtn(0, onDividerClick));

    for (let i = 1; i <= pageCount; i++) {
      const item = this._createPlaceholder(i);
      this.container.appendChild(item);
      this.observer.observe(item);
      this.items.push(item);
      if (i < pageCount || dividerType === 'blank') {
        if (insertDividers && dividerType === 'split') {
          this.container.appendChild(this._createSplitDivider(i, onDividerClick));
        } else if (dividerType === 'blank') {
          this.container.appendChild(this._createInsertBtn(i, onDividerClick));
        }
      }
    }
  }

  _createPlaceholder(pageNum) {
    const item = document.createElement('div');
    item.className = 'thumb-item';
    item.dataset.page = pageNum;
    const ph = document.createElement('div');
    ph.className = 'thumb-placeholder';
    ph.textContent = pageNum;
    item.appendChild(ph);
    const label = document.createElement('div');
    label.className = 'thumb-label';
    label.textContent = pageNum;
    item.appendChild(label);
    if (this.onThumbnailClick) item.addEventListener('click', () => this.onThumbnailClick(pageNum, item));
    return item;
  }

  async _renderThumbnail(el, pageNum) {
    try {
      const canvas = await this.renderer.renderThumbnail(pageNum, this.maxWidth);
      const img = this.renderer.canvasToImg(canvas);
      const ph = el.querySelector('.thumb-placeholder');
      if (ph) el.replaceChild(img, ph);
      el.dataset.rendered = 'true';
    } catch (e) { console.error(`Thumbnail render failed for page ${pageNum}:`, e); }
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
    btn.title = afterPage === 0 ? '先頭に白紙ページを挿入' : `ページ ${afterPage} の後に白紙ページを挿入`;
    btn.addEventListener('click', () => { if (onClick) onClick(afterPage); });
    return btn;
  }

  insertBlankIndicator(afterPage) {
    const items = Array.from(this.container.children);
    let targetIndex = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i].classList.contains('blank-insert-btn') && parseInt(items[i].dataset.afterPage, 10) === afterPage) {
        targetIndex = i; break;
      }
    }
    const blankItem = document.createElement('div');
    blankItem.className = 'thumb-item blank-page';
    blankItem.dataset.isBlank = 'true';
    blankItem.dataset.afterPage = afterPage;
    const ph = document.createElement('div');
    ph.className = 'thumb-placeholder';
    ph.textContent = '白紙';
    blankItem.appendChild(ph);
    const label = document.createElement('div');
    label.className = 'thumb-label';
    label.textContent = '白紙';
    blankItem.appendChild(label);
    blankItem.addEventListener('click', () => blankItem.remove());
    if (targetIndex >= 0 && targetIndex + 1 < items.length) {
      this.container.insertBefore(blankItem, items[targetIndex + 1]);
    } else {
      this.container.appendChild(blankItem);
    }
    return blankItem;
  }

  getBlankPages() {
    return Array.from(this.container.querySelectorAll('.thumb-item.blank-page')).map(el => parseInt(el.dataset.afterPage, 10));
  }

  clear() {
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    this.container.innerHTML = '';
    this.items = [];
  }
}