/**
 * PanelUI - 悬浮面板 UI 主模块
 * 负责面板渲染、框架管理、编辑弹窗、事件处理
 */
var PanelUI = (() => {
    const PANEL_ID = 'gph-ext-panel';
    const esc = PlatformAdapter.escapeHTML;

    /* --- 应用状态 --- */
    let frameworks = [];
    let generalPrompts = [];
    let catalogPrompts = [];
    let activeFrameworkIndex = 0;
    let panelEl = null;
    let bodyEl = null;
    let selectorEl = null;

    /* --- SVG 图标 --- */
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
        panelEl = document.createElement('div');
        panelEl.id = PANEL_ID;
        const html = `
            <div id="gph-header">
                <h3 id="gph-title">${LOGO_SVG} AI 多角色框架助手 (${esc(platformName)})</h3>
                <button id="gph-close-btn" class="gph-header-btn" title="关闭面板">&times;</button>
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
        PlatformAdapter.setSafeHTML(panelEl, html);
        document.body.appendChild(panelEl);

        bodyEl = panelEl.querySelector('#gph-body');
        selectorEl = panelEl.querySelector('#gph-framework-selector');

        _setupDrag();
        _bindEvents();
        _restorePanelState();
    };

    /* --- 加载数据 --- */
    const loadData = async () => {
        frameworks = await StorageManager.loadFrameworks();
        generalPrompts = await StorageManager.loadGeneralPrompts();
        activeFrameworkIndex = frameworks.length > 0 ? 0 : -1;

        /* --- 加载提示词目录（内置，独立于通用指令） --- */
        try {
            const url = chrome.runtime.getURL('prompts/catalog_prompts.json');
            const res = await fetch(url);
            if (res.ok) catalogPrompts = await res.json();
        } catch (e) { console.warn('[GPH] 加载提示词目录失败'); }
    };

    /* --- 渲染主界面 --- */
    const render = () => {
        const currentTab = TabManager.getActiveTab();
        const roleIndex = TabManager.getActiveRoleIndex();

        _updateToolbarVisibility(currentTab);
        _updateSelector();

        const roles = (frameworks.length > 0 && frameworks[activeFrameworkIndex])
            ? frameworks[activeFrameworkIndex].roles : [];
        const tabsHTML = TabManager.renderTabs(roles);

        let contentHTML = '';
        if (currentTab === 'general') {
            contentHTML = TabManager.renderGeneralPanel(generalPrompts);
        } else if (currentTab === 'catalog') {
            contentHTML = TabManager.renderCatalogPanel(catalogPrompts);
        } else {
            contentHTML = _renderFrameworkContent(roleIndex);
        }

        PlatformAdapter.setSafeHTML(bodyEl, tabsHTML + contentHTML);
    };

    /* --- 框架模式内容渲染 --- */
    const _renderFrameworkContent = (roleIndex) => {
        if (frameworks.length === 0) {
            return `<div class="gph-empty-state">
                <div class="gph-empty-icon">🚀</div>
                <h4>无可用框架</h4>
                <p>点击 "+" 向AI请求生成框架JSON，<br>然后点击【粘贴JSON】来创建您的第一个框架。</p>
            </div>`;
        }

        const fw = frameworks[activeFrameworkIndex];
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
        const hasNoFrameworks = frameworks.length === 0;

        // 框架管理按钮：在框架标签页 OR 没有任何框架时显示
        const fwControls = ['#gph-new-framework-btn', '#gph-paste-json-btn', '#gph-manage-framework-btn'];
        fwControls.forEach(sel => {
            const el = panelEl.querySelector(sel);
            if (el) el.style.display = (isFramework || hasNoFrameworks) ? '' : 'none';
        });

        // 选择器：在框架标签页 OR 没有任何框架时显示（显示“无可用框架”）
        if (selectorEl) {
            selectorEl.style.display = (isFramework || hasNoFrameworks) ? '' : 'none';
        }

        // 组合并发送：仅在框架标签页且有框架时显示
        const combineBtn = panelEl.querySelector('#gph-combine-send-btn');
        if (combineBtn) {
            combineBtn.style.display = (isFramework && !hasNoFrameworks) ? '' : 'none';
        }

        const manageGenBtn = panelEl.querySelector('#gph-manage-general-btn');
        if (manageGenBtn) {
            manageGenBtn.style.display = (tab === 'general') ? '' : 'none';
        }
    };

    /* --- 更新框架选择器 --- */
    const _updateSelector = () => {
        if (frameworks.length === 0) {
            PlatformAdapter.setSafeHTML(selectorEl, '<option>无可用框架</option>');
            selectorEl.disabled = true;
        } else {
            selectorEl.disabled = false;
            const opts = frameworks.map((f, i) =>
                `<option value="${i}" ${i === activeFrameworkIndex ? 'selected' : ''}>${esc(f.name)}</option>`
            ).join('');
            PlatformAdapter.setSafeHTML(selectorEl, opts);
        }
    };

    /* --- 事件绑定 --- */
    const _bindEvents = () => {
        TabManager.onTabChange((tab, roleIndex) => render());
        TabManager.bindEvents(bodyEl);

        panelEl.addEventListener('click', async (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.id === 'gph-close-btn') { toggle(); }
            else if (target.id === 'gph-new-framework-btn') { _handleGenerate(); }
            else if (target.id === 'gph-paste-json-btn') { _handlePasteJSON(); }
            else if (target.id === 'gph-manage-framework-btn') { _handleManageFrameworks(); }
            else if (target.id === 'gph-manage-general-btn') { _handleManageGeneral(); }
            else if (target.id === 'gph-combine-send-btn') { _handleCombineSend(); }
            else if (target.id === 'gph-auto-continue-btn') { _handleAutoContinue(); }
            else if (target.classList.contains('gph-general-prompt-btn')) { _handleGeneralPromptClick(target); }
            else if (target.classList.contains('gph-catalog-use-btn')) { _handleCatalogUse(target); }
        });

        selectorEl.addEventListener('change', (e) => {
            activeFrameworkIndex = parseInt(e.target.value);
            TabManager.setActiveRoleIndex(0);
            render();
        });

        PromptEngine.onAutoContinueStatusChange((running, count) => {
            const btn = panelEl.querySelector('#gph-auto-continue-btn');
            const counter = panelEl.querySelector('#gph-continue-counter');
            if (btn) btn.firstChild.textContent = running ? '停止' : '自动继续';
            if (counter) counter.textContent = running ? `(${count})` : '';
        });
    };

    /* --- 生成新框架 --- */
    const _handleGenerate = () => {
        ModalManager.show({
            title: '创建新框架',
            contentHTML: `
                <label for="gph-domain-input">请输入领域/主题：</label>
                <input type="text" id="gph-domain-input" placeholder="例如：软件开发项目重构">
                <div class="gph-form-grid">
                    <div><label>角色数量:</label><input type="number" id="gph-rc" value="3" min="2" max="5"></div>
                    <div><label>核心指令数:</label><input type="number" id="gph-dc" value="3" min="1" max="5"></div>
                    <div><label>考量维度数:</label><input type="number" id="gph-cc" value="3" min="1" max="5"></div>
                    <div><label>个性化配置数:</label><input type="number" id="gph-pc" value="2" min="1" max="4"></div>
                </div>`,
            onConfirm: (modal, close) => {
                const domain = modal.querySelector('#gph-domain-input').value.trim();
                if (!domain) return;
                const counts = {
                    roles: parseInt(modal.querySelector('#gph-rc').value) || 3,
                    directives: parseInt(modal.querySelector('#gph-dc').value) || 3,
                    considerations: parseInt(modal.querySelector('#gph-cc').value) || 3,
                    personalization: parseInt(modal.querySelector('#gph-pc').value) || 2,
                };
                const prompt = PromptEngine.buildMetaPrompt(domain, counts);
                const textarea = PlatformAdapter.getTextarea();
                if (!textarea) {
                    ModalManager.alert('错误', '无法找到AI输入框，请刷新页面重试。');
                    return;
                }
                PlatformAdapter.setInputValue(textarea, prompt);
                close();
                PlatformAdapter.clickSend();
                setTimeout(() => {
                    PlatformAdapter.clickSend();
                    ModalManager.alert('操作指南',
                        '元提示词已发送给AI。<br>请等待AI生成JSON后，<strong>复制完整JSON</strong>，点击【粘贴JSON】创建框架。');
                }, 500);
            }
        });
    };

    /* --- 粘贴JSON创建框架 --- */
    const _handlePasteJSON = () => {
        ModalManager.show({
            title: '从JSON创建新框架',
            contentHTML: '<p>请将AI生成的JSON代码块粘贴到下方。</p><textarea id="gph-json-area" rows="10" placeholder="在此处粘贴..."></textarea>',
            confirmText: '创建',
            onConfirm: async (modal, close) => {
                let raw = modal.querySelector('#gph-json-area').value.trim();
                if (!raw) return;
                const match = raw.match(/```json\s*([\s\S]*?)\s*```/);
                const jsonStr = match ? match[1] : (raw.startsWith('{') ? raw : null);
                close();
                if (!jsonStr) {
                    ModalManager.alert('提取失败', '未能找到有效的JSON代码块。');
                    return;
                }
                try {
                    const data = JSON.parse(jsonStr);
                    if (!data.name || !Array.isArray(data.roles) || data.roles.length === 0)
                        throw new Error('JSON缺少 "name" 或 "roles"');
                    data.id = `framework_${Date.now()}`;
                    data.createdAt = new Date().toISOString();
                    frameworks.push(data);
                    activeFrameworkIndex = frameworks.length - 1;
                    TabManager.setActiveRoleIndex(0);
                    await StorageManager.saveFrameworks(frameworks);
                    render();
                    ModalManager.alert('成功', `框架 <strong>${esc(data.name)}</strong> 创建成功！`);
                } catch (err) {
                    ModalManager.alert('解析失败', `JSON解析错误：${esc(err.message)}`);
                }
            }
        });
    };

    /* --- 管理框架 --- */
    const _handleManageFrameworks = () => {
        const listHTML = () => {
            if (frameworks.length === 0) return '<p>没有可管理的框架。</p>';
            return `<ul class="gph-manage-list">${frameworks.map((f, i) =>
                `<li class="gph-manage-item" data-index="${i}">
                    <span class="gph-manage-name" title="${esc(f.name)}">${esc(f.name)}</span>
                    <div class="gph-manage-actions">
                        <button class="gph-btn gph-btn-sm gph-edit-fw-btn">编辑</button>
                        <button class="gph-btn gph-btn-sm gph-btn-danger gph-delete-fw-btn">删除</button>
                    </div>
                </li>`).join('')}</ul>`;
        };

        const modal = ModalManager.show({
            title: '管理框架', contentHTML: listHTML(),
            showCancel: false, confirmText: '关闭',
            onConfirm: (_m, close) => close()
        });

        modal.querySelector('#gph-modal-body').addEventListener('click', (e) => {
            const item = e.target.closest('.gph-manage-item');
            if (!item) return;
            const idx = parseInt(item.dataset.index);

            if (e.target.closest('.gph-edit-fw-btn')) {
                _showEditFrameworkModal(idx);
            } else if (e.target.closest('.gph-delete-fw-btn')) {
                ModalManager.confirm('确认删除', `删除框架 <strong>"${esc(frameworks[idx].name)}"</strong>？`, async () => {
                    frameworks.splice(idx, 1);
                    activeFrameworkIndex = Math.min(activeFrameworkIndex, frameworks.length - 1);
                    if (frameworks.length === 0) activeFrameworkIndex = -1;
                    await StorageManager.saveFrameworks(frameworks);
                    render();
                    PlatformAdapter.setSafeHTML(modal.querySelector('#gph-modal-body'), listHTML());
                });
            }
        });
    };

    /* --- 编辑框架弹窗 --- */
    const _showEditFrameworkModal = (index) => {
        const fw = JSON.parse(JSON.stringify(frameworks[index]));
        const dynList = (items, type) => items.map(item => {
            if (type === 'string') {
                return `<div class="gph-dyn-item" data-type="string"><input type="text" value="${esc(item)}">
                    <button type="button" class="gph-btn gph-btn-sm gph-btn-danger gph-del-item">-</button></div>`;
            }
            return `<div class="gph-dyn-item" data-type="consideration"><input type="text" value="${esc(item.text || '')}">
                <input type="checkbox" ${item.enabled ? 'checked' : ''}>
                <button type="button" class="gph-btn gph-btn-sm gph-btn-danger gph-del-item">-</button></div>`;
        }).join('');

        const rolesHTML = fw.roles.map((role, ri) => `
            <details class="gph-edit-role" data-ri="${ri}">
                <summary>${esc(role.name)} <button type="button" class="gph-btn gph-btn-sm gph-btn-danger gph-del-item">删除</button></summary>
                <div class="gph-edit-role-body">
                    <label>名称</label><input type="text" class="e-rn" value="${esc(role.name)}">
                    <label>描述</label><textarea class="e-rd">${esc(role.description)}</textarea>
                    <label>定义</label><textarea class="e-rdf">${esc(role.definition)}</textarea>
                    <label>核心指令</label>
                    <div class="gph-dyn-list" data-list="directives">${dynList(role.directives, 'string')}</div>
                    <button type="button" class="gph-btn gph-btn-sm gph-add-item" data-type="string">+</button>
                    <label>考量维度</label>
                    <div class="gph-dyn-list" data-list="considerations">${dynList(role.considerations, 'consideration')}</div>
                    <button type="button" class="gph-btn gph-btn-sm gph-add-item" data-type="consideration">+</button>
                    <label>时效性</label><input type="text" class="e-rt" value="${esc(role.timeliness)}">
                    <label>自我修正</label>
                    <div class="gph-dyn-list" data-list="selfCorrection">${dynList(role.selfCorrection, 'string')}</div>
                    <button type="button" class="gph-btn gph-btn-sm gph-add-item" data-type="string">+</button>
                </div>
            </details>`).join('');

        const modal = ModalManager.show({
            title: `编辑: ${fw.name}`,
            contentHTML: `<form id="gph-edit-form">
                <fieldset class="gph-fieldset"><legend>基础信息</legend>
                    <label>名称</label><input type="text" id="e-fn" value="${esc(fw.name)}">
                    <label>领域</label><input type="text" id="e-fd" value="${esc(fw.domain)}">
                </fieldset>
                <fieldset class="gph-fieldset"><legend>通用指令</legend>
                    <label>身份</label><textarea id="e-ci">${esc(fw.commonDirectives.identity)}</textarea>
                    <label>规则</label>
                    <div class="gph-dyn-list" id="e-cr">${dynList(fw.commonDirectives.rules, 'string')}</div>
                    <button type="button" class="gph-btn gph-btn-sm gph-add-item" data-target="e-cr" data-type="string">+</button>
                </fieldset>
                <fieldset class="gph-fieldset"><legend>角色</legend>
                    <div id="e-roles">${rolesHTML}</div>
                    <button type="button" id="gph-add-role" class="gph-btn gph-btn-primary">+ 添加角色</button>
                </fieldset>
            </form>`,
            confirmText: '保存',
            onConfirm: async (m, close) => {
                const form = m.querySelector('#gph-edit-form');
                const updated = {
                    ...fw,
                    name: form.querySelector('#e-fn').value,
                    domain: form.querySelector('#e-fd').value,
                    commonDirectives: {
                        identity: form.querySelector('#e-ci').value,
                        rules: [...form.querySelectorAll('#e-cr .gph-dyn-item input[type="text"]')].map(el => el.value)
                    },
                    roles: [...form.querySelectorAll('.gph-edit-role')].map(re => ({
                        name: re.querySelector('.e-rn').value,
                        description: re.querySelector('.e-rd').value,
                        definition: re.querySelector('.e-rdf').value,
                        timeliness: re.querySelector('.e-rt').value,
                        directives: [...re.querySelectorAll('[data-list="directives"] input')].map(el => el.value),
                        selfCorrection: [...re.querySelectorAll('[data-list="selfCorrection"] input')].map(el => el.value),
                        considerations: [...re.querySelectorAll('[data-list="considerations"] .gph-dyn-item')].map(ci => ({
                            text: ci.querySelector('input[type="text"]').value,
                            enabled: ci.querySelector('input[type="checkbox"]').checked
                        })),
                        personalizationProfiles: fw.roles[parseInt(re.dataset.ri)]?.personalizationProfiles || []
                    }))
                };
                frameworks[index] = updated;
                await StorageManager.saveFrameworks(frameworks);
                render();
                close();
                ModalManager.alert('成功', `框架 <strong>${esc(updated.name)}</strong> 已更新！`);
            }
        });

        /* --- 动态添加/删除事件 --- */
        modal.querySelector('#gph-modal-body').addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.classList.contains('gph-del-item')) {
                btn.closest('.gph-dyn-item, details')?.remove();
            } else if (btn.classList.contains('gph-add-item')) {
                const type = btn.dataset.type;
                const container = btn.previousElementSibling;
                const html = type === 'consideration'
                    ? '<div class="gph-dyn-item" data-type="consideration"><input type="text"><input type="checkbox" checked><button type="button" class="gph-btn gph-btn-sm gph-btn-danger gph-del-item">-</button></div>'
                    : '<div class="gph-dyn-item" data-type="string"><input type="text"><button type="button" class="gph-btn gph-btn-sm gph-btn-danger gph-del-item">-</button></div>';
                PlatformAdapter.appendSafeHTML(container, html);
            } else if (btn.id === 'gph-add-role') {
                const rolesContainer = modal.querySelector('#e-roles');
                const ri = rolesContainer.children.length;
                const newRole = `<details class="gph-edit-role" data-ri="${ri}" open>
                    <summary>新角色 <button type="button" class="gph-btn gph-btn-sm gph-btn-danger gph-del-item">删除</button></summary>
                    <div class="gph-edit-role-body">
                        <label>名称</label><input type="text" class="e-rn" value="新角色">
                        <label>描述</label><textarea class="e-rd"></textarea>
                        <label>定义</label><textarea class="e-rdf"></textarea>
                        <label>核心指令</label><div class="gph-dyn-list" data-list="directives"></div>
                        <button type="button" class="gph-btn gph-btn-sm gph-add-item" data-type="string">+</button>
                        <label>考量维度</label><div class="gph-dyn-list" data-list="considerations"></div>
                        <button type="button" class="gph-btn gph-btn-sm gph-add-item" data-type="consideration">+</button>
                        <label>时效性</label><input type="text" class="e-rt" value="">
                        <label>自我修正</label><div class="gph-dyn-list" data-list="selfCorrection"></div>
                        <button type="button" class="gph-btn gph-btn-sm gph-add-item" data-type="string">+</button>
                    </div></details>`;
                PlatformAdapter.appendSafeHTML(rolesContainer, newRole);
            }
        });
    };

    /* --- 管理通用提示词 --- */
    const _handleManageGeneral = () => {
        const editPrompt = (idx = -1) => {
            const isEdit = idx > -1;
            const p = isEdit ? generalPrompts[idx] : { name: '', prompt: '' };
            ModalManager.show({
                title: isEdit ? '编辑通用指令' : '新增通用指令',
                contentHTML: `<label>名称:</label><input type="text" id="gph-pn" value="${esc(p.name)}">
                    <label>内容:</label><textarea id="gph-pc" rows="6">${esc(p.prompt)}</textarea>`,
                confirmText: '保存',
                onConfirm: async (m, close) => {
                    const name = m.querySelector('#gph-pn').value.trim();
                    const content = m.querySelector('#gph-pc').value.trim();
                    if (!name || !content) return;
                    if (isEdit) generalPrompts[idx] = { name, prompt: content };
                    else generalPrompts.push({ name, prompt: content });
                    await StorageManager.saveGeneralPrompts(generalPrompts);
                    close();
                    _handleManageGeneral();
                    render();
                }
            });
        };

        const listHTML = () => {
            if (generalPrompts.length === 0) return '<p>没有通用指令。</p>';
            return `<ul class="gph-manage-list">${generalPrompts.map((p, i) =>
                `<li class="gph-manage-item" data-index="${i}">
                    <span class="gph-manage-name">${esc(p.name)}</span>
                    <div class="gph-manage-actions">
                        <button class="gph-btn gph-btn-sm gph-edit-gp">编辑</button>
                        <button class="gph-btn gph-btn-sm gph-btn-danger gph-del-gp">删除</button>
                    </div></li>`).join('')}</ul>`;
        };

        const modal = ModalManager.show({
            title: '管理通用指令',
            contentHTML: `${listHTML()}<div style="text-align:right;margin-top:16px"><button id="gph-add-gp" class="gph-btn gph-btn-primary">新增指令</button></div>`,
            showCancel: false, confirmText: '关闭',
            onConfirm: (_m, close) => close()
        });

        modal.querySelector('#gph-modal-body').addEventListener('click', async (e) => {
            if (e.target.closest('#gph-add-gp')) { editPrompt(); return; }
            const item = e.target.closest('.gph-manage-item');
            if (!item) return;
            const idx = parseInt(item.dataset.index);
            if (e.target.closest('.gph-edit-gp')) editPrompt(idx);
            else if (e.target.closest('.gph-del-gp')) {
                ModalManager.confirm('确认删除', `删除 "${esc(generalPrompts[idx].name)}"？`, async () => {
                    generalPrompts.splice(idx, 1);
                    await StorageManager.saveGeneralPrompts(generalPrompts);
                    PlatformAdapter.setSafeHTML(modal.querySelector('#gph-modal-body'),
                        `${listHTML()}<div style="text-align:right;margin-top:16px"><button id="gph-add-gp" class="gph-btn gph-btn-primary">新增指令</button></div>`);
                    render();
                });
            }
        });
    };

    /* --- 组合并发送 --- */
    const _handleCombineSend = () => {
        if (activeFrameworkIndex < 0) return;
        const fw = frameworks[activeFrameworkIndex];
        const roleIndex = TabManager.getActiveRoleIndex();
        const role = fw.roles[roleIndex];
        const textarea = PlatformAdapter.getTextarea();
        if (!textarea) { ModalManager.alert('错误', '找不到输入框。'); return; }

        const dirIndices = [...bodyEl.querySelectorAll('#gph-directives-list input:checked')].map(cb => parseInt(cb.dataset.index));
        const conIndices = [...bodyEl.querySelectorAll('#gph-considerations-list input:checked')].map(cb => parseInt(cb.dataset.index));
        const personalizations = [...bodyEl.querySelectorAll('.gph-section input[type="radio"]:checked')].map(r => ({
            profileIndex: parseInt(r.dataset.profileIndex), optionIndex: parseInt(r.dataset.optionIndex)
        }));

        const userContent = PlatformAdapter.getInputValue(textarea);
        const combined = PromptEngine.combinePrompt(fw, role, dirIndices, conIndices, personalizations, userContent);
        PlatformAdapter.setInputValue(textarea, combined);
        PlatformAdapter.clickSend();
    };

    /* --- 自动继续 --- */
    const _handleAutoContinue = () => {
        if (PromptEngine.isAutoContinuing()) { PromptEngine.stopAutoContinue(); return; }
        const n = parseInt(panelEl.querySelector('#gph-continue-times').value) || 5;
        ModalManager.alert('任务准备就绪',
            `请手动发送初始请求。脚本将在AI开始生成后自动继续 ${n} 次。<br>随时点击【停止】中止。`);
        PromptEngine.startAutoContinue(n);
    };

    /* --- 通用提示词点击 --- */
    const _handleGeneralPromptClick = (btn) => {
        const idx = parseInt(btn.dataset.index);
        const prompt = generalPrompts[idx];
        if (!prompt) return;
        const textarea = PlatformAdapter.getTextarea();
        if (textarea) PlatformAdapter.setInputValue(textarea, prompt.prompt, true);
    };

    /* --- 提示词目录使用 --- */
    const _handleCatalogUse = (btn) => {
        const idx = parseInt(btn.dataset.index);
        const prompt = catalogPrompts[idx];
        if (!prompt) return;
        const textarea = PlatformAdapter.getTextarea();
        if (textarea) PlatformAdapter.setInputValue(textarea, prompt.prompt, true);
    };

    /* --- 拖拽功能 --- */
    const _setupDrag = () => {
        const header = panelEl.querySelector('#gph-header');
        let dragging = false, ox, oy;
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            dragging = true; ox = e.clientX - panelEl.offsetLeft; oy = e.clientY - panelEl.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (dragging) { panelEl.style.left = `${e.clientX - ox}px`; panelEl.style.top = `${e.clientY - oy}px`; }
        });
        document.addEventListener('mouseup', () => { if (dragging) { dragging = false; _savePanelState(); } });
        if (window.ResizeObserver) new ResizeObserver(_savePanelState).observe(panelEl);
    };

    /* --- 面板状态持久化 --- */
    const _savePanelState = () => {
        StorageManager.savePanelState({
            left: panelEl.style.left, top: panelEl.style.top,
            width: panelEl.style.width, height: panelEl.style.height
        });
    };

    const _restorePanelState = async () => {
        const state = await StorageManager.loadPanelState();
        if (state) Object.assign(panelEl.style, state);
    };

    /** 切换面板显示/隐藏 */
    const toggle = () => {
        if (panelEl) {
            panelEl.style.display = panelEl.style.display === 'none' ? 'flex' : 'none';
        }
    };

    /** 面板是否可见 */
    const isVisible = () => panelEl && panelEl.style.display !== 'none';

    return { createPanel, loadData, render, toggle, isVisible };
})();
