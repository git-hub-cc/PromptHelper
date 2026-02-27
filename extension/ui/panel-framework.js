/**
 * PanelFrameworkHandlers - 框架管理模块
 * 依赖: _PHS (共享面板状态), PlatformAdapter, ModalManager, PromptEngine, StorageManager, PanelUI
 * 包含: 生成框架、粘贴JSON、管理框架列表、编辑框架
 */
var PanelFrameworkHandlers = (() => {
    const esc = PlatformAdapter.escapeHTML;

    /* --- 生成新框架（向AI发送元提示词） --- */
    const handleGenerate = () => {
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
    const handlePasteJSON = () => {
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
                    _PHS.frameworks.push(data);
                    _PHS.activeFrameworkIndex = _PHS.frameworks.length - 1;
                    TabManager.setActiveRoleIndex(0);
                    await StorageManager.saveFrameworks(_PHS.frameworks);
                    PanelUI.render();
                    ModalManager.alert('成功', `框架 <strong>${esc(data.name)}</strong> 创建成功！`);
                } catch (err) {
                    ModalManager.alert('解析失败', `JSON解析错误：${esc(err.message)}`);
                }
            }
        });
    };

    /* --- 管理框架列表 --- */
    const handleManageFrameworks = () => {
        const listHTML = () => {
            if (_PHS.frameworks.length === 0) return '<p>没有可管理的框架。</p>';
            return `<ul class="gph-manage-list">${_PHS.frameworks.map((f, i) =>
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
                showEditFrameworkModal(idx);
            } else if (e.target.closest('.gph-delete-fw-btn')) {
                ModalManager.confirm('确认删除', `删除框架 <strong>"${esc(_PHS.frameworks[idx].name)}"</strong>？`, async () => {
                    _PHS.frameworks.splice(idx, 1);
                    _PHS.activeFrameworkIndex = Math.min(_PHS.activeFrameworkIndex, _PHS.frameworks.length - 1);
                    if (_PHS.frameworks.length === 0) _PHS.activeFrameworkIndex = -1;
                    await StorageManager.saveFrameworks(_PHS.frameworks);
                    PanelUI.render();
                    PlatformAdapter.setSafeHTML(modal.querySelector('#gph-modal-body'), listHTML());
                });
            }
        });
    };

    /* --- 编辑框架弹窗 --- */
    const showEditFrameworkModal = (index) => {
        const fw = JSON.parse(JSON.stringify(_PHS.frameworks[index]));
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
                _PHS.frameworks[index] = updated;
                await StorageManager.saveFrameworks(_PHS.frameworks);
                PanelUI.render();
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

    return { handleGenerate, handlePasteJSON, handleManageFrameworks, showEditFrameworkModal };
})();
