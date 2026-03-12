/**
 * PanelActionHandlers - 通用面板操作模块
 * 依赖: _PHS (共享面板状态), PlatformAdapter, ModalManager, PromptEngine, StorageManager, PanelUI, TabManager
 * 包含: 管理通用指令、组合发送、自动继续、通用提示词点击、提示词目录使用
 */
var PanelActionHandlers = (() => {
    const esc = PlatformAdapter.escapeHTML;

    /* --- 目录管理: 编辑/新增 --- */
    const _editCatalogPrompt = (idx = -1) => {
        const isEdit = idx > -1;
        const p = isEdit ? _PHS.catalogPrompts[idx] : { name: '', prompt: '' };
        ModalManager.show({
            title: isEdit ? '编辑提示词' : '新增提示词',
            contentHTML: `
                <label>名称:</label><input type="text" id="gph-pn" value="${esc(p.name)}">
                <label>内容:</label><textarea id="gph-pc" rows="10">${esc(p.prompt)}</textarea>`,
            confirmText: '保存',
            onConfirm: async (m, close) => {
                const name = m.querySelector('#gph-pn').value.trim();
                const content = m.querySelector('#gph-pc').value.trim();
                if (!name || !content) return;
                
                if (isEdit) {
                    _PHS.catalogPrompts[idx] = { name, prompt: content };
                } else {
                    _PHS.catalogPrompts.unshift({ name, prompt: content }); // 新增的放前面
                }
                
                await StorageManager.saveCatalogPrompts(_PHS.catalogPrompts);
                close();
                PanelUI.render();
            }
        });
    };

    const handleCatalogAdd = () => {
        _editCatalogPrompt();
    };

    const handleCatalogEdit = (btn) => {
        const idx = parseInt(btn.dataset.index);
        _editCatalogPrompt(idx);
    };

    const handleCatalogDelete = (btn) => {
        const idx = parseInt(btn.dataset.index);
        const p = _PHS.catalogPrompts[idx];
        if (!p) return;

        ModalManager.confirm('确认删除', `确定要删除提示词 "${esc(p.name)}" 吗？`, async () => {
            _PHS.catalogPrompts.splice(idx, 1);
            await StorageManager.saveCatalogPrompts(_PHS.catalogPrompts);
            PanelUI.render();
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

    /* --- 提示词目录使用 --- */
    const handleCatalogUse = (btn) => {
        const idx = parseInt(btn.dataset.index);
        const prompt = _PHS.catalogPrompts[idx];
        if (!prompt) return;
        const textarea = PlatformAdapter.getTextarea();
        if (textarea) PlatformAdapter.setInputValue(textarea, prompt.prompt, true);
    };

    return {
        handleCatalogAdd,
        handleCatalogEdit,
        handleCatalogDelete,
        handleCombineSend,
        handleAutoContinue,
        handleCatalogUse
    };
})();
