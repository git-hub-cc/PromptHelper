/**
 * CodeBlockFolder - Gemini 代码块折叠模块
 * 自动识别 Gemini 生成的代码块，注入折叠按钮，并默认折叠。
 */
var CodeBlockFolder = (() => {
    const COLLAPSE_BTN_CLASS = 'gph-code-collapse-btn';
    const COLLAPSED_CLASS = 'gph-code-collapsed';

    /* --- 创建折叠按钮 --- */
    const _createButton = (isCollapsed) => {
        const btn = document.createElement('button');
        btn.className = `mdc-icon-button mat-mdc-icon-button mat-mdc-button-base ${COLLAPSE_BTN_CLASS}`;
        btn.setAttribute('aria-label', isCollapsed ? '展开代码' : '折叠代码');
        btn.title = isCollapsed ? '展开代码' : '折叠代码';
        
        // 使用 Google Symbols 风格图标
        btn.innerHTML = `
            <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
            <mat-icon role="img" class="mat-icon notranslate gds-icon-s google-symbols mat-ligature-font mat-icon-no-color" aria-hidden="true">
                ${isCollapsed ? 'unfold_more' : 'unfold_less'}
            </mat-icon>
            <span class="mat-focus-indicator"></span>
            <span class="mat-mdc-button-touch-target"></span>
        `;
        return btn;
    };

    /**
     * 处理单个代码块
     * @param {Element} codeBlockEl <code-block> 元素
     */
    const _processCodeBlock = (codeBlockEl) => {
        if (codeBlockEl.dataset.gphProcessed) return;
        codeBlockEl.dataset.gphProcessed = 'true';

        // 查找头部装饰区和内容区
        const header = codeBlockEl.querySelector('.code-block-decoration');
        const buttonsContainer = header ? header.querySelector('.buttons') : null;
        const contentContainer = codeBlockEl.querySelector('.formatted-code-block-internal-container');

        if (!buttonsContainer || !contentContainer) return;

        // 默认设置为折叠状态
        codeBlockEl.classList.add(COLLAPSED_CLASS);
        contentContainer.style.display = 'none';

        // 创建并注入按钮
        const toggleBtn = _createButton(true);
        buttonsContainer.insertBefore(toggleBtn, buttonsContainer.firstChild);

        // 点击事件
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isCollapsed = codeBlockEl.classList.contains(COLLAPSED_CLASS);
            if (isCollapsed) {
                codeBlockEl.classList.remove(COLLAPSED_CLASS);
                contentContainer.style.display = 'block';
                toggleBtn.querySelector('mat-icon').textContent = 'unfold_less';
                toggleBtn.title = '折叠代码';
            } else {
                codeBlockEl.classList.add(COLLAPSED_CLASS);
                contentContainer.style.display = 'none';
                toggleBtn.querySelector('mat-icon').textContent = 'unfold_more';
                toggleBtn.title = '展开代码';
            }
        });
    };

    /**
     * 初始化观察器，监听新生成的代码块
     */
    const init = () => {
        // 先处理现有代码块
        document.querySelectorAll('code-block').forEach(_processCodeBlock);

        // 监听动态生成的代码块
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'CODE-BLOCK') {
                                _processCodeBlock(node);
                            } else {
                                node.querySelectorAll('code-block').forEach(_processCodeBlock);
                            }
                        }
                    });
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log('[GPH] 代码块自动折叠模块已启动');
    };

    return { init };
})();
