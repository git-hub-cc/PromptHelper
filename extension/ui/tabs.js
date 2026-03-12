/**
 * TabManager - 标签页系统
 * 管理角色标签、通用指令标签和提示词目录标签的切换与渲染
 */
var TabManager = (() => {
    /* --- 状态 --- */
    let _activeTab = 'framework'; // 'framework' | 'general' | 'catalog'
    let _activeRoleIndex = 0;
    let _onTabChange = null;

    /** 注册标签切换回调 */
    const onTabChange = (callback) => { _onTabChange = callback; };

    /** 获取当前激活标签 */
    const getActiveTab = () => _activeTab;

    /** 获取当前角色索引 */
    const getActiveRoleIndex = () => _activeRoleIndex;

    /** 设置角色索引 */
    const setActiveRoleIndex = (index) => { _activeRoleIndex = index; };

    /** 设置当前激活标签 */
    const setActiveTab = (tab) => { _activeTab = tab; };

    /**
     * 渲染标签栏 HTML
     * @param {Array} roles - 角色列表
     * @returns {string} HTML
     */
    const renderTabs = (roles = []) => {
        const esc = PlatformAdapter.escapeHTML;
        let html = '';

        /* --- 角色标签 --- */
        roles.forEach((r, i) => {
            const isActive = _activeTab === 'framework' && i === _activeRoleIndex;
            html += `<li class="gph-tab ${isActive ? 'gph-tab-active' : ''}" data-tab="role" data-index="${i}">
                <span class="gph-tab-icon">👤</span>${esc(r.name)}
            </li>`;
        });

        /* --- 提示词目录标签 --- */
        html += `<li class="gph-tab gph-tab-special ${_activeTab === 'catalog' ? 'gph-tab-active' : ''}" data-tab="catalog">
            <span class="gph-tab-icon">📂</span>提示词目录
        </li>`;

        return `<ul class="gph-tabs">${html}</ul>`;
    };

    /**
     * 绑定标签点击事件
     * @param {HTMLElement} container - 标签容器
     */
    const bindEvents = (container) => {
        if (!container || container.dataset.gphTabBound) return;
        container.dataset.gphTabBound = 'true';

        container.addEventListener('click', (e) => {
            const tab = e.target.closest('.gph-tab');
            if (!tab) return;

            const tabType = tab.dataset.tab;

            if (tabType === 'role') {
                _activeTab = 'framework';
                _activeRoleIndex = parseInt(tab.dataset.index, 10);
            } else if (tabType === 'catalog') {
                _activeTab = 'catalog';
            }

            if (_onTabChange) _onTabChange(_activeTab, _activeRoleIndex);
        });
    };

    /**
     * 渲染提示词目录面板（内置提示词目录浏览）
     * @param {Array} catalogPrompts - 提示词目录数据
     * @returns {string} HTML
     */
    const renderCatalogPanel = (catalogPrompts) => {
        const esc = PlatformAdapter.escapeHTML;
        
        let listHTML = '';
        if (!catalogPrompts || catalogPrompts.length === 0) {
            listHTML = `<div class="gph-empty-state">
                <div class="gph-empty-icon">📂</div>
                <h4>提示词目录为空</h4>
                <p>点击下方按钮添加您的第一个提示词。</p>
            </div>`;
        } else {
            const items = catalogPrompts.map((p, i) =>
                `<div class="gph-catalog-item" data-index="${i}">
                    <div class="gph-catalog-item-header">
                        <span class="gph-catalog-name">${esc(p.name)}</span>
                        <div class="gph-catalog-actions">
                            <button class="gph-btn gph-btn-sm gph-catalog-use-btn" data-index="${i}">使用</button>
                            <button class="gph-btn gph-btn-sm gph-catalog-edit-btn" data-index="${i}">编辑</button>
                            <button class="gph-btn gph-btn-sm gph-btn-danger gph-catalog-del-btn" data-index="${i}">删除</button>
                        </div>
                    </div>
                    <div class="gph-catalog-preview">${esc(p.prompt?.substring(0, 120) || '')}${(p.prompt?.length > 120) ? '...' : ''}</div>
                </div>`
            ).join('');
            listHTML = `<div class="gph-catalog-list">${items}</div>`;
        }

        return `
            <div class="gph-catalog-container">
                <div class="gph-catalog-toolbar">
                    <button id="gph-catalog-add-btn" class="gph-btn gph-btn-primary">新增提示词</button>
                </div>
                ${listHTML}
            </div>`;
    };

    return {
        onTabChange,
        getActiveTab,
        getActiveRoleIndex,
        setActiveRoleIndex,
        setActiveTab,
        renderTabs,
        bindEvents,
        renderCatalogPanel
    };
})();
