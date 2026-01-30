/**
 * PromptEngine - 提示词引擎模块
 * 管理元提示词模板、框架组合发送、自动继续功能
 */
const PromptEngine = (() => {
    /* --- 元提示词模板（运行时从文件加载或使用内嵌默认值） --- */
    let _metaTemplate = '';

    /** 加载元提示词模板 */
    const loadMetaTemplate = async () => {
        try {
            const url = chrome.runtime.getURL('prompts/meta_prompt.md');
            const res = await fetch(url);
            if (res.ok) {
                _metaTemplate = await res.text();
                console.log('[GPH] 元提示词模板加载成功');
            }
        } catch (e) {
            console.warn('[GPH] 加载元提示词模板失败:', e);
        }
    };

    /**
     * 构建元提示词（填入参数后的完整提示词）
     * @param {string} domain - 领域/主题
     * @param {Object} counts - 各项数量
     * @returns {string} 完整元提示词
     */
    const buildMetaPrompt = (domain, counts = {}) => {
        const { roles = 3, directives = 3, considerations = 3, personalization = 2 } = counts;
        let prompt = _metaTemplate
            .replace('[ROLE_COUNT]', roles)
            .replace('[DIRECTIVES_COUNT]', directives)
            .replace('[CONSIDERATIONS_COUNT]', considerations)
            .replace('[PERSONALIZATION_COUNT]', personalization);
        return prompt + domain;
    };

    /**
     * 根据当前选择的角色和配置，组合完整的提示词
     * @param {Object} framework - 当前框架数据
     * @param {Object} role - 当前角色数据
     * @param {number[]} checkedDirectiveIndices - 选中的指令索引
     * @param {number[]} checkedConsiderationIndices - 选中的考量索引
     * @param {Array} personalizationSelections - [{profileIndex, optionIndex}]
     * @param {string} userContent - 用户输入的任务内容
     * @returns {string} 完整提示词
     */
    const combinePrompt = (framework, role, checkedDirectiveIndices, checkedConsiderationIndices, personalizationSelections, userContent) => {
        const parts = [
            framework.commonDirectives.identity,
            ...framework.commonDirectives.rules,
            `\n# 当前角色：${role.name}\n${role.definition}`
        ];

        /* --- 核心指令 --- */
        const directives = checkedDirectiveIndices.map(i => role.directives[i]).filter(Boolean);
        if (directives.length > 0) {
            parts.push(`\n## 核心指令：\n- ${directives.join('\n- ')}`);
        }

        /* --- 个性化指令 --- */
        const personalDirectives = personalizationSelections
            .map(({ profileIndex, optionIndex }) =>
                role.personalizationProfiles?.[profileIndex]?.options?.[optionIndex]?.directive
            )
            .filter(Boolean);

        if (personalDirectives.length > 0) {
            parts.push(`\n## 个性化指令：\n- ${personalDirectives.join('\n- ')}`);
        }

        /* --- 用户任务内容 --- */
        if (userContent && userContent.trim()) {
            parts.push(`\n## 任务内容：\n${userContent}`);
        }

        /* --- 多维度考量 --- */
        const considerations = checkedConsiderationIndices
            .map(i => role.considerations[i]?.text)
            .filter(Boolean);

        if (considerations.length > 0) {
            parts.push(`\n## 输出要求：\n请在你的回答中，必须包含对以下维度的深入分析：\n- ${considerations.join('\n- ')}`);
        }

        /* --- 时效性与自我修正 --- */
        parts.push(`\n---\n${role.timeliness}\n\n${role.selfCorrection.join('\n')}`);

        return parts.join('\n\n');
    };

    /* --- 自动继续功能 --- */
    let _isAutoContinuing = false;
    let _continueCount = 0;
    let _onStatusChange = null;

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /** 设置状态变化回调 */
    const onAutoContinueStatusChange = (callback) => { _onStatusChange = callback; };

    /** 获取自动继续状态 */
    const isAutoContinuing = () => _isAutoContinuing;

    /** 停止自动继续 */
    const stopAutoContinue = () => {
        _isAutoContinuing = false;
        _continueCount = 0;
        if (_onStatusChange) _onStatusChange(false, 0);
        console.log('[GPH] 自动继续任务已停止');
    };

    /**
     * 启动自动继续
     * @param {number} times - 继续次数
     */
    const startAutoContinue = async (times) => {
        _continueCount = times;
        _isAutoContinuing = true;

        while (_continueCount > 0 && _isAutoContinuing) {
            if (_onStatusChange) _onStatusChange(true, _continueCount);

            /* --- 等待 AI 开始生成 --- */
            while (!PlatformAdapter.isGenerating() && _isAutoContinuing) {
                await sleep(500);
            }
            if (!_isAutoContinuing) break;

            /* --- 等待 AI 生成结束 --- */
            while (PlatformAdapter.isGenerating() && _isAutoContinuing) {
                await sleep(500);
            }
            if (!_isAutoContinuing) break;

            await sleep(1000);

            /* --- 发送 "继续" --- */
            const textarea = PlatformAdapter.getTextarea();
            if (!textarea) {
                ModalManager.alert('错误', '在自动继续期间找不到输入框，任务已中止。');
                stopAutoContinue();
                return;
            }

            PlatformAdapter.setInputValue(textarea, '继续');
            await sleep(200);

            /* --- 等待发送按钮可用 --- */
            let attempts = 0;
            while (_isAutoContinuing && attempts < 20) {
                if (PlatformAdapter.isSendReady()) break;
                await sleep(500);
                attempts++;
            }

            if (!_isAutoContinuing) break;

            if (attempts >= 20) {
                ModalManager.alert('错误', '发送按钮长时间未启用，自动继续任务已中止。');
                stopAutoContinue();
                return;
            }

            PlatformAdapter.clickSend();
            PlatformAdapter.scrollToBottom();
            _continueCount--;
        }

        stopAutoContinue();
    };

    return {
        loadMetaTemplate,
        buildMetaPrompt,
        combinePrompt,
        startAutoContinue,
        stopAutoContinue,
        isAutoContinuing,
        onAutoContinueStatusChange
    };
})();
