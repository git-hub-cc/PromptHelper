/**
 * ToolbarInjector - Gemini 工具栏注入模块
 * 在 Gemini 原生「工具」按钮右侧注入「Helper」按钮。
 * 点击后直接打开/关闭 PromptHelper 面板，面板定位在按钮附近。
 * 注入时机：页面加载后即通过 MutationObserver 监听，无需等待面板初始化。
 */
var ToolbarInjector = (() => {
    const HELPER_BTN_ID = 'gph-helper-toolbar-btn';
    const PANEL_GAP = 12; // 面板与按钮的间距 px

    let _btnEl = null;
    let _panelInitialized = false;

    /* --- SVG 图标 --- */
    const _iconSVG = `<svg width="18" height="18" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="gph-tlg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stop-color="#007ACC"/><stop offset="1" stop-color="#009688"/>
        </linearGradient></defs>
        <rect width="64" height="64" rx="12" fill="url(#gph-tlg)"/>
        <g fill="white" fill-opacity="0.9">
            <rect x="30" y="38" width="4" height="8" rx="2"/>
            <rect x="22.5" y="27" width="8" height="4" rx="2" transform="rotate(-60 26.5 29)"/>
            <rect x="33.5" y="27" width="8" height="4" rx="2" transform="rotate(60 37.5 29)"/>
            <circle cx="32" cy="50" r="6"/><circle cx="18" cy="26" r="6"/><circle cx="46" cy="26" r="6"/>
            <path d="M32 28 L37.2 31 L37.2 37 L32 40 L26.8 37 L26.8 31 Z"/>
        </g>
    </svg>`;

    /* --- 创建 Helper 按钮 --- */
    const _createButton = () => {
        const btn = document.createElement('button');
        btn.id = HELPER_BTN_ID;
        btn.className = 'gph-helper-toolbar-btn';
        btn.setAttribute('aria-label', 'PromptHelper');
        btn.title = 'PromptHelper';
        btn.innerHTML = `${_iconSVG}<span class="gph-helper-btn-label">Helper</span>`;
        return btn;
    };

    /* --- 将面板定位到按钮旁边 --- */
    const _positionPanelNearButton = () => {
        const panelEl = document.getElementById('gph-ext-panel');
        if (!panelEl || !_btnEl) return;

        const btnRect = _btnEl.getBoundingClientRect();
        const panelW = panelEl.offsetWidth || 560;
        const panelH = panelEl.offsetHeight || 400;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // 默认在按钮正下方
        let top = btnRect.bottom + PANEL_GAP;
        let left = btnRect.left;

        // 右侧超出屏幕，向左移
        if (left + panelW > vw - 8) {
            left = vw - panelW - 8;
        }

        panelEl.style.left = `${Math.max(8, left)}px`;
        panelEl.style.right = 'auto';

        // 下方空间不足，改为按钮上方
        if (top + panelH > vh - 8) {
            // 面板在按钮上方，通过 bottom 固定与按钮的距离
            // 让浏览器顶部视野自然截断面板，不强行将面板下压挡住按钮
            panelEl.style.top = 'auto';
            panelEl.style.bottom = `${vh - btnRect.top + PANEL_GAP}px`;
        } else {
            // 面板在按钮正下方
            panelEl.style.top = `${top}px`;
            panelEl.style.bottom = 'auto';
        }
    };

    /* --- 确保面板已初始化（懒加载） --- */
    const _ensurePanelReady = async () => {
        if (_panelInitialized && document.getElementById('gph-ext-panel')) return true;

        // 检查依赖模块是否可用
        if (typeof PanelUI === 'undefined' || typeof StorageManager === 'undefined') {
            console.warn('[GPH] 面板模块未加载');
            return false;
        }

        // 若面板 DOM 已存在但状态丢失，跳过重建
        if (document.getElementById('gph-ext-panel')) {
            _panelInitialized = true;
            return true;
        }

        try {
            // 检测平台
            const platform = PlatformAdapter.detect();
            const platformName = platform ? platform.name : 'Gemini';

            // 初始化存储
            const defaultPromptsUrl = chrome.runtime.getURL('prompts/general_prompts.json');
            await StorageManager.initDefaults(defaultPromptsUrl);

            // 加载元模板
            if (typeof PromptEngine !== 'undefined') {
                await PromptEngine.loadMetaTemplate();
            }

            // 创建面板
            PanelUI.createPanel(platformName);
            await PanelUI.loadData();
            PanelUI.render();

            _panelInitialized = true;
            console.log('[GPH] 面板由 ToolbarInjector 懒加载完成');
            return true;
        } catch (e) {
            console.error('[GPH] 懒加载面板失败:', e);
            return false;
        }
    };

    /* --- 按钮点击处理 --- */
    const _onButtonClick = async (e) => {
        e.stopPropagation();

        const ready = await _ensurePanelReady();
        if (!ready) return;

        const panelEl = document.getElementById('gph-ext-panel');
        if (!panelEl) return;

        const isHidden = panelEl.style.display === 'none' || panelEl.style.display === '';

        if (isHidden) {
            // 先定位再显示，避免闪烁
            panelEl.style.display = 'flex';
            _positionPanelNearButton();
            _btnEl.classList.add('gph-helper-btn-active');
        } else {
            panelEl.style.display = 'none';
            _btnEl.classList.remove('gph-helper-btn-active');
        }
    };

    /* --- 查找注入点：toolbox-drawer 元素 --- */
    const _findAnchor = () => document.querySelector('toolbox-drawer');

    /* --- 执行注入 --- */
    const _inject = () => {
        if (document.getElementById(HELPER_BTN_ID)) return;

        const anchor = _findAnchor();
        if (!anchor) return;

        _btnEl = _createButton();
        _btnEl.addEventListener('click', _onButtonClick);
        anchor.insertAdjacentElement('afterend', _btnEl);

        /* 窗口缩放时保持面板相对按钮的位置不变 */
        window.addEventListener('resize', () => {
            const panelEl = document.getElementById('gph-ext-panel');
            if (panelEl && panelEl.style.display !== 'none' && panelEl.style.display !== '') {
                _positionPanelNearButton();
            }
        });

        console.log('[GPH] Helper 按钮已注入到 Gemini 工具栏');
    };

    /* --- 公共初始化（带 MutationObserver 重试） --- */
    const init = () => {
        _inject();

        if (document.getElementById(HELPER_BTN_ID)) return;

        const observer = new MutationObserver(() => {
            if (!document.getElementById(HELPER_BTN_ID) && _findAnchor()) {
                _inject();
            }
            if (document.getElementById(HELPER_BTN_ID)) {
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // 最多观察 30 秒
        setTimeout(() => observer.disconnect(), 30000);
    };

    /* --- 暴露面板激活状态同步（供 panel.js 关闭按钮调用） --- */
    const onPanelClose = () => {
        if (_btnEl) _btnEl.classList.remove('gph-helper-btn-active');
    };

    return { init, onPanelClose };
})();
