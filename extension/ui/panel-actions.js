/**
 * PanelActionHandlers - 通用面板操作模块
 * 依赖: _PHS (共享面板状态), PlatformAdapter, ModalManager, PromptEngine, StorageManager, PanelUI, TabManager
 * 包含: 管理通用指令、组合发送、自动继续、通用提示词点击、提示词目录使用
 */
var PanelActionHandlers = (() => {
    const esc = PlatformAdapter.escapeHTML;

    /* --- 管理通用提示词 --- */
    const handleManageGeneral = () => {
        const editPrompt = (idx = -1) => {
            const isEdit = idx > -1;
            const p = isEdit ? _PHS.generalPrompts[idx] : { name: '', prompt: '' };
            ModalManager.show({
                title: isEdit ? '编辑通用指令' : '新增通用指令',
                contentHTML: `<label>名称:</label><input type="text" id="gph-pn" value="${esc(p.name)}">
                    <label>内容:</label><textarea id="gph-pc" rows="6">${esc(p.prompt)}</textarea>`,
                confirmText: '保存',
                onConfirm: async (m, close) => {
                    const name = m.querySelector('#gph-pn').value.trim();
                    const content = m.querySelector('#gph-pc').value.trim();
                    if (!name || !content) return;
                    if (isEdit) _PHS.generalPrompts[idx] = { name, prompt: content };
                    else _PHS.generalPrompts.push({ name, prompt: content });
                    await StorageManager.saveGeneralPrompts(_PHS.generalPrompts);
                    close();
                    handleManageGeneral();
                    PanelUI.render();
                }
            });
        };

        const listHTML = () => {
            if (_PHS.generalPrompts.length === 0) return '<p>没有通用指令。</p>';
            return `<ul class="gph-manage-list">${_PHS.generalPrompts.map((p, i) =>
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
                ModalManager.confirm('确认删除', `删除 "${esc(_PHS.generalPrompts[idx].name)}"？`, async () => {
                    _PHS.generalPrompts.splice(idx, 1);
                    await StorageManager.saveGeneralPrompts(_PHS.generalPrompts);
                    PlatformAdapter.setSafeHTML(modal.querySelector('#gph-modal-body'),
                        `${listHTML()}<div style="text-align:right;margin-top:16px"><button id="gph-add-gp" class="gph-btn gph-btn-primary">新增指令</button></div>`);
                    PanelUI.render();
                });
            }
        });
    };

    /* --- 组合并发送 --- */
    const handleCombineSend = (bodyEl) => {
        if (_PHS.activeFrameworkIndex < 0) return;
        const fw = _PHS.frameworks[_PHS.activeFrameworkIndex];
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
    const handleAutoContinue = (panelEl) => {
        if (PromptEngine.isAutoContinuing()) { PromptEngine.stopAutoContinue(); return; }
        const n = parseInt(panelEl.querySelector('#gph-continue-times').value) || 5;
        ModalManager.alert('任务准备就绪',
            `请手动发送初始请求。脚本将在AI开始生成后自动继续 ${n} 次。<br>随时点击【停止】中止。`);
        PromptEngine.startAutoContinue(n);
    };

    /* --- 通用提示词按钮点击 --- */
    const handleGeneralPromptClick = (btn) => {
        const idx = parseInt(btn.dataset.index);
        const prompt = _PHS.generalPrompts[idx];
        if (!prompt) return;
        const textarea = PlatformAdapter.getTextarea();
        if (textarea) PlatformAdapter.setInputValue(textarea, prompt.prompt, true);
    };

    /* --- 提示词目录使用 --- */
    const handleCatalogUse = (btn) => {
        const idx = parseInt(btn.dataset.index);
        const prompt = _PHS.catalogPrompts[idx];
        if (!prompt) return;
        const textarea = PlatformAdapter.getTextarea();
        if (textarea) PlatformAdapter.setInputValue(textarea, prompt.prompt, true);
    };

    return {
        handleManageGeneral,
        handleCombineSend,
        handleAutoContinue,
        handleGeneralPromptClick,
        handleCatalogUse
    };
})();
