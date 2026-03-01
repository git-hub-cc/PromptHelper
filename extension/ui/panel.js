/**
 * PanelUI Core - 悬浮面板核心模块
 * 包含: 共享状态 _PHS、面板创建/渲染/事件绑定、拖拽、状态持久化、toggle
 * 依赖（需先加载）: panel-framework.js → PanelFrameworkHandlers
 *                  panel-actions.js   → PanelActionHandlers
 */

/* ============================================================
 * 共享面板状态（_PHS）
 * 供 panel-framework.js 和 panel-actions.js 读写
 * ============================================================ */
var _PHS = {
    frameworks: [],
    generalPrompts: [],
    catalogPrompts: [],
    activeFrameworkIndex: 0,
    panelEl: null,
    bodyEl: null,
    selectorEl: null
};

/* ============================================================
 * PanelUI - 面板主模块
 * ============================================================ */
var PanelUI = (() => {
    const PANEL_ID = 'gph-ext-panel';
    const esc = PlatformAdapter.escapeHTML;

    /* --- SVG Logo --- */
    const LOGO_SVG = `<svg width="20" height="20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="gph-lg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stop-color="#007ACC"/><stop offset="1" stop-color="#009688"/>
        </linearGradient></defs>
        <rect width="64" height="64" rx="12" fill="url(#gph-lg)"/>
        <g fill="white" fill-opacity="0.9">
            <rect x="30" y="38" width="4" height="8" rx="2"/>
            <rect x="22.5" y="27" width="8" height="4" rx="2" transform="rotate(-60 26.5 29)"/>
            <rect x="33.5" y="27" width="8" height="4" rx="2" transform="rotate(60 37.5 29)"/>
            <circle cx="32" cy="50" r="6"/><circle cx="18" cy="26" r="6"/><circle cx="46" cy="26" r="6"/>
            <path d="M32 28 L37.2 31 L37.2 37 L32 40 L26.8 37 L26.8 31 Z"/>
        </g></svg>`;

    /** 创建面板 DOM */
    const createPanel = (platformName) => {
        _PHS.panelEl = document.createElement('div');
        _PHS.panelEl.id = PANEL_ID;
        const html = `
            <div class="gph-top-resize-handle"></div>
            <div id="gph-header">
                <h3 id="gph-title">${LOGO_SVG} AI 多角色框架助手 (${esc(platformName)})</h3>
            </div>
            <div id="gph-toolbar">
                <select id="gph-framework-selector"></select>
                <button id="gph-new-framework-btn" class="gph-btn gph-btn-primary" title="生成元提示词">+</button>
                <button id="gph-paste-json-btn" class="gph-btn gph-btn-secondary" title="粘贴JSON创建框架">粘贴JSON</button>
                <button id="gph-manage-framework-btn" class="gph-btn gph-btn-secondary">管理框架</button>
                <button id="gph-manage-general-btn" class="gph-btn gph-btn-secondary">管理通用</button>
            </div>
            <div id="gph-body"></div>
            <div id="gph-footer">
                <div id="gph-auto-continue-wrapper">
                    <input type="number" id="gph-continue-times" value="5" min="1" max="99" title="自动继续次数">
                    <button id="gph-auto-continue-btn" class="gph-btn gph-btn-secondary">自动继续<span id="gph-continue-counter"></span></button>
                </div>
                <button id="gph-combine-send-btn" class="gph-btn gph-btn-primary">组合并发送</button>
            </div>`;
        PlatformAdapter.setSafeHTML(_PHS.panelEl, html);
        document.body.appendChild(_PHS.panelEl);

        _PHS.bodyEl = _PHS.panelEl.querySelector('#gph-body');
        _PHS.selectorEl = _PHS.panelEl.querySelector('#gph-framework-selector');

        _setupTopResize();
        _setupDragging();
        _bindEvents();
        _restorePanelState();
    };

    /* --- 加载数据 --- */
    const loadData = async () => {
        _PHS.frameworks = await StorageManager.loadFrameworks();
        _PHS.generalPrompts = await StorageManager.loadGeneralPrompts();
        _PHS.activeFrameworkIndex = _PHS.frameworks.length > 0 ? 0 : -1;

        try {
            const url = chrome.runtime.getURL('prompts/catalog_prompts.json');
            const res = await fetch(url);
            if (res.ok) _PHS.catalogPrompts = await res.json();
        } catch (e) { console.warn('[GPH] 加载提示词目录失败'); }
    };

    /* --- 渲染主界面 --- */
    const render = () => {
        const currentTab = TabManager.getActiveTab();
        const roleIndex = TabManager.getActiveRoleIndex();

        _updateToolbarVisibility(currentTab);
        _updateSelector();

        const roles = (_PHS.frameworks.length > 0 && _PHS.frameworks[_PHS.activeFrameworkIndex])
            ? _PHS.frameworks[_PHS.activeFrameworkIndex].roles : [];
        const tabsHTML = TabManager.renderTabs(roles);

        let contentHTML = '';
        if (currentTab === 'general') {
            contentHTML = TabManager.renderGeneralPanel(_PHS.generalPrompts);
        } else if (currentTab === 'catalog') {
            contentHTML = TabManager.renderCatalogPanel(_PHS.catalogPrompts);
        } else {
            contentHTML = _renderFrameworkContent(roleIndex);
        }

        PlatformAdapter.setSafeHTML(_PHS.bodyEl, tabsHTML + contentHTML);
    };

    /* --- 框架内容渲染 --- */
    const _renderFrameworkContent = (roleIndex) => {
        if (_PHS.frameworks.length === 0) {
            return `<div class="gph-empty-state">
                <div class="gph-empty-icon">🚀</div>
                <h4>无可用框架</h4>
                <p>点击 "+" 向AI请求生成框架JSON，<br>然后点击【粘贴JSON】来创建您的第一个框架。</p>
            </div>`;
        }

        const fw = _PHS.frameworks[_PHS.activeFrameworkIndex];
        if (!fw) return '';
        const role = fw.roles[roleIndex];
        if (!role) return '<div class="gph-empty-state"><p>请选择一个角色。</p></div>';

        const directivesHTML = role.directives.map((d, i) =>
            `<li class="gph-check-item"><input type="checkbox" id="dir-${i}" data-index="${i}" checked>
             <label for="dir-${i}">${esc(d)}</label></li>`
        ).join('');

        const considerationsHTML = role.considerations.map((c, i) =>
            `<li class="gph-check-item"><input type="checkbox" id="con-${i}" data-index="${i}" checked>
             <label for="con-${i}">${esc(c.text)}</label></li>`
        ).join('');

        let personalizationHTML = '';
        if (Array.isArray(role.personalizationProfiles) && role.personalizationProfiles.length > 0) {
            const profilesHTML = role.personalizationProfiles.map((profile, pi) => {
                const groupName = `gph-prof-${pi}-${profile.profileName.replace(/\s+/g, '-')}`;
                const optionsHTML = profile.options.map((opt, oi) =>
                    `<div class="gph-radio-item">
                        <input type="radio" id="prof-${pi}-${oi}" name="${groupName}"
                               data-profile-index="${pi}" data-option-index="${oi}" ${opt.default ? 'checked' : ''}>
                        <label for="prof-${pi}-${oi}">${esc(opt.optionName)}</label>
                    </div>`
                ).join('');
                return `<div class="gph-profile-group"><h6>${esc(profile.profileName)}</h6>${optionsHTML}</div>`;
            }).join('');
            personalizationHTML = `<div class="gph-section"><h5>🎨 个性化配置</h5>${profilesHTML}</div>`;
        }

        return `<div id="gph-role-details">
            <div class="gph-section"><h5>📋 使用场景</h5><p>${esc(role.description)}</p></div>
            <div class="gph-section"><h5>🎭 角色定义</h5><p>${esc(role.definition)}</p></div>
            <div class="gph-section"><h5>⚙️ 核心指令</h5><ul id="gph-directives-list">${directivesHTML}</ul></div>
            <div class="gph-section"><h5>🔍 多维度考量</h5><ul id="gph-considerations-list">${considerationsHTML}</ul></div>
            ${personalizationHTML}
        </div>`;
    };

    /* --- 工具栏可见性 --- */
    const _updateToolbarVisibility = (tab) => {
        const isFramework = tab === 'framework';
        const hasNoFrameworks = _PHS.frameworks.length === 0;

        const fwControls = ['#gph-new-framework-btn', '#gph-paste-json-btn', '#gph-manage-framework-btn'];
        fwControls.forEach(sel => {
            const el = _PHS.panelEl.querySelector(sel);
            if (el) el.style.display = (isFramework || hasNoFrameworks) ? '' : 'none';
        });

        if (_PHS.selectorEl) {
            _PHS.selectorEl.style.display = (isFramework || hasNoFrameworks) ? '' : 'none';
        }

        const combineBtn = _PHS.panelEl.querySelector('#gph-combine-send-btn');
        if (combineBtn) {
            combineBtn.style.display = (isFramework && !hasNoFrameworks) ? '' : 'none';
        }

        const manageGenBtn = _PHS.panelEl.querySelector('#gph-manage-general-btn');
        if (manageGenBtn) {
            manageGenBtn.style.display = (tab === 'general') ? '' : 'none';
        }
    };

    /* --- 更新框架选择器 --- */
    const _updateSelector = () => {
        if (_PHS.frameworks.length === 0) {
            PlatformAdapter.setSafeHTML(_PHS.selectorEl, '<option>无可用框架</option>');
            _PHS.selectorEl.disabled = true;
        } else {
            _PHS.selectorEl.disabled = false;
            const opts = _PHS.frameworks.map((f, i) =>
                `<option value="${i}" ${i === _PHS.activeFrameworkIndex ? 'selected' : ''}>${esc(f.name)}</option>`
            ).join('');
            PlatformAdapter.setSafeHTML(_PHS.selectorEl, opts);
        }
    };

    /* --- 事件绑定 --- */
    const _bindEvents = () => {
        TabManager.onTabChange(() => render());
        TabManager.bindEvents(_PHS.bodyEl);

        _PHS.panelEl.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.id === 'gph-new-framework-btn') { PanelFrameworkHandlers.handleGenerate(); }
            else if (target.id === 'gph-paste-json-btn') { PanelFrameworkHandlers.handlePasteJSON(); }
            else if (target.id === 'gph-manage-framework-btn') { PanelFrameworkHandlers.handleManageFrameworks(); }
            else if (target.id === 'gph-manage-general-btn') { PanelActionHandlers.handleManageGeneral(); }
            else if (target.id === 'gph-combine-send-btn') { PanelActionHandlers.handleCombineSend(_PHS.bodyEl); }
            else if (target.id === 'gph-auto-continue-btn') { PanelActionHandlers.handleAutoContinue(_PHS.panelEl); }
            else if (target.classList.contains('gph-general-prompt-btn')) { PanelActionHandlers.handleGeneralPromptClick(target); }
            else if (target.classList.contains('gph-catalog-use-btn')) { PanelActionHandlers.handleCatalogUse(target); }
        });

        _PHS.selectorEl.addEventListener('change', (e) => {
            _PHS.activeFrameworkIndex = parseInt(e.target.value);
            TabManager.setActiveRoleIndex(0);
            render();
        });

        PromptEngine.onAutoContinueStatusChange((running, count) => {
            const btn = _PHS.panelEl.querySelector('#gph-auto-continue-btn');
            const counter = _PHS.panelEl.querySelector('#gph-continue-counter');
            if (btn) btn.firstChild.textContent = running ? '停止' : '自动继续';
            if (counter) counter.textContent = running ? `(${count})` : '';

            if (typeof ToolbarInjector !== 'undefined') {
                ToolbarInjector.updateAutoContinueStatus(running, count);
            }
        });
    };

    /* --- 顶边拖拽调整高度 --- */
    const _setupTopResize = () => {
        const handle = _PHS.panelEl.querySelector('.gph-top-resize-handle');
        if (!handle) return;
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startTop = _PHS.panelEl.offsetTop;
            const startHeight = _PHS.panelEl.offsetHeight;

            const onMove = (ev) => {
                const dy = ev.clientY - startY;
                const newHeight = startHeight - dy;
                if (newHeight < 200) return;
                _PHS.panelEl.style.top = `${startTop + dy}px`;
                _PHS.panelEl.style.height = `${newHeight}px`;
                _PHS.panelEl.style.maxHeight = 'none'; // 解除 max-height 限制
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                _savePanelState();
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    };

    /** 面板整体拖拽移动 */
    const _setupDragging = () => {
        const header = _PHS.panelEl.querySelector('#gph-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            // 如果点击的是按钮则不触发拖拽
            if (e.target.closest('button')) return;
            
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = _PHS.panelEl.offsetLeft;
            const startTop = _PHS.panelEl.offsetTop;

            const onMove = (ev) => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                
                _PHS.panelEl.style.left = `${startLeft + dx}px`;
                _PHS.panelEl.style.top = `${startTop + dy}px`;
                _PHS.panelEl.style.right = 'auto';
                _PHS.panelEl.style.bottom = 'auto';
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                _savePanelState();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    };



    /* --- 面板状态持久化 --- */
    const _savePanelState = () => {
        StorageManager.savePanelState({
            left: _PHS.panelEl.style.left, 
            top: _PHS.panelEl.style.top,
            right: _PHS.panelEl.style.right,
            bottom: _PHS.panelEl.style.bottom,
            width: _PHS.panelEl.style.width, 
            height: _PHS.panelEl.style.height
        });
    };

    const _restorePanelState = async () => {
        const state = await StorageManager.loadPanelState();
        if (state) {
            // 清理旧状态，防止冲突
            _PHS.panelEl.style.left = '';
            _PHS.panelEl.style.top = '';
            _PHS.panelEl.style.right = '';
            _PHS.panelEl.style.bottom = '';
            Object.assign(_PHS.panelEl.style, state);
        }
    };

    /** 切换面板显示/隐藏 */
    const toggle = () => {
        if (_PHS.panelEl) {
            _PHS.panelEl.style.display = _PHS.panelEl.style.display === 'none' ? 'flex' : 'none';
        }
    };

    /** 面板是否可见 */
    const isVisible = () => _PHS.panelEl && _PHS.panelEl.style.display !== 'none';

    return { createPanel, loadData, render, toggle, isVisible };
})();
