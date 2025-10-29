javascript:(function main() {
    /* --- 脚本面板和样式的唯一ID --- */
    const panelId = 'gemini-mvp-helper';
    const styleId = 'gemini-mvp-helper-styles';
    const existingPanel = document.getElementById(panelId);

    /* --- 如果面板已存在，则移除并退出，实现开关效果 --- */
    if (existingPanel) {
        const existingStyle = document.getElementById(styleId);
        existingPanel.remove();
        if (existingStyle) {
            existingStyle.remove();
        }
        return;
    }

    /* --- 本地存储KEY --- */
    const STORAGE_KEY_PROMPTS = 'gph_promptGroups_v2';
    const STORAGE_KEY_PANEL_STATE = 'gph_panelState_v1';

    /* --- 支持的AI平台配置 (已添加 scrollContainerSelector) --- */
    const AI_PLATFORMS = [
        {name: 'AIStudio', hostname: 'aistudio.google.com', selector: 'ms-autosize-textarea textarea', sendButtonSelector: 'button[aria-label="Run"]', stoppableSelector: 'button.run-button.stoppable', scrollContainerSelector: 'ms-autoscroll-container'},
        {name: 'Gemini', hostname: 'gemini.google.com', selector: 'rich-textarea .ql-editor[contenteditable="true"]', sendButtonSelector: '[aria-label="Send message"]', stoppableSelector: '[aria-label="Stop generating"]', scrollContainerSelector: 'ms-autoscroll-container'},
        {name: 'ChatGPT', hostname: 'chatgpt.com', selector: '#prompt-textarea', sendButtonSelector: 'button[data-testid="send-button"]', stoppableSelector: 'button[aria-label*="Stop"]', scrollContainerSelector: 'main .overflow-y-auto'},
        {name: 'DeepSeek', hostname: 'chat.deepseek.com', selector: 'textarea#chat-input', sendButtonSelector: 'button[class*="send-btn"]', stoppableSelector: 'button[class*="stop-btn"]', scrollContainerSelector: 'div.custom-scroll-container'},
    ];

    /* --- 脚本状态变量 --- */
    let activePlatform = null;
    let activeTextarea = null;
    const currentHostname = window.location.hostname + window.location.pathname;

    /* --- 查找当前页面匹配的AI平台和输入框 --- */
    for (const platform of AI_PLATFORMS) {
        if (currentHostname.includes(platform.hostname)) {
            const element = document.querySelector(platform.selector);
            if (element) {
                activePlatform = platform;
                activeTextarea = element;
                break;
            }
        }
    }

    /* --- 默认数据结构：仅在localStorage为空时使用 --- */
    const DEFAULT_PROMPT_GROUPS = [
        {
            "name": "分析",
            "prompts": [
                "你是一位资深的 [领域，如：商业、技术、市场] 分析师，请以专业、客观、严谨的视角完成本次任务。",
                "请对以下核心内容进行深入、全面的分析。",
                "请从多个维度进行分析，例如：[维度A], [维度B], [维度C]，并尽可能拓展更多创新性视角。",
                "请进行SWOT分析（优势、劣势、机会、威胁）。",
                "请对比分析 [方案A] 和 [方案B] 的优缺点、成本效益和潜在风险。",
                "请基于以下背景信息或参考材料进行分析：",
                "本次分析的核心目标是 [具体目标，如：找出潜在风险、评估可行性、提出优化策略]。",
                "请遵循以下格式和结构输出你的回答：\n1. 核心摘要 (Executive Summary)\n2. 分点详细论述 (Detailed Analysis)\n3. 结论与建议 (Conclusion & Recommendations)",
                "请以Markdown的表格形式进行总结。",
                "请使用中文进行回复。如果包含专业术语，请附上简要解释。",
                "本次任务专注于理论和策略，禁止输出任何代码块。",
                "请保持客观中立，论证需有事实或逻辑支撑，避免主观臆断。",
                "分析的深度应触及问题的本质，避免泛泛而谈。",
                "在分析的最后，请提出3个开放性问题以引导下一步的思考。"
            ],
            "itemOrder": [
                "main_content", "prompt_0", "prompt_1", "prompt_6", "prompt_2", "prompt_3", "prompt_4", "prompt_5", "prompt_12", "prompt_11", "prompt_7", "prompt_8", "prompt_9", "prompt_10", "prompt_13"
            ]
        },
        {
            "name": "方案",
            "prompts": [
                "请分析代码，并识别出所有未完成的功能、TODO注释以及代码中提及的“后续实现”部分。",
                "基于当前代码分析出的尚未完成的重构内容和相关建议，遵循“功能优先、关联聚合、不输出代码”的原则。",
                "请识别出代码中急需重构的部分。针对每一部分，提出具体的重构建议，并说明其必要性（例如：提升可维护性、降低耦合度）。",
                "请评估并提出多种方案（例如：最小侵入的临时方案、彻底重构的长期方案），并以表格形式对比它们的优缺点、实施成本和潜在风险。",
                "运用最佳实践",
                "本次不输出代码，给出最小侵入的方案。"
            ],
            "itemOrder": [ "main_content", "prompt_0", "prompt_1", "prompt_2", "prompt_3", "prompt_4", "prompt_5" ]
        },
        {
            "name": "文件",
            "prompts": [
                "将上述功能分为两个阶段，第一个阶段是后端修改，第二个阶段是前端修改，本次输出需要修改哪些文件",
                "使用方案一，给出详细的技术方案，分成多个阶段进行实现，说明每个阶段实现的逻辑与文件变动情况。",
                "最终要求达到商用级别",
                "本次不输出代码,对上述内容进行修改，列出需要修改的文件，同一个文件仅列出一次，要求最小侵入，仅修改必要部分",
            ],
            "itemOrder": [ "main_content", "prompt_0", "prompt_1", "prompt_2", "prompt_3" ]
        },
        {
            "name": "代码",
            "prompts": [
                "强制要求输出完整代码，分多次输出，每次1000行内容，同一个文件放在同一次回复，首次说明分几次",
                "给出修复后的最终完整代码，对于没有变化的文件不需要输出。要求最小侵入，仅修改必要部分",
                "请编写一个Python脚本。该脚本的功能是：\n1. 读取名为 'input_content.txt' 的文件。\n2. 将读取的内容填充到预设的文件结构中。\n3. 在当前目录下生成对应的文件和文件夹。\n4. 脚本本身不应包含 'input_content.txt' 的内容，而是动态读取。\n5. 生成的文件内容不应被Markdown代码块（```）包裹。",
                "注释全部使用使用 /* --- xxx--- */",
                "在编码时，请严格避免以下问题/模式：[在此处列出要避免的具体问题，例如：使用全局变量、循环导入等]。",
                "遵循行业最佳实践（如SOLID, DRY）编写代码",
                "请使用中文进行回复，并且代码中的所有注释也必须使用中文。",
            ],
            "itemOrder": [ "main_content", "prompt_0", "prompt_1", "prompt_2", "prompt_3", "prompt_4", "prompt_5", "prompt_6" ]
        },
        {
            "name": "Bug",
            "prompts": [
                "请基于以下问题描述、错误日志和相关代码，进行一次彻底的根本原因分析 (Root Cause Analysis, RCA)。",
                "分析出原因是什么，这是一个极其复杂的问题，一步步分析后给出解决方案，本次不输出代码。",
                "本次任务专注于分析和策略，严禁输出完整的、可直接运行的代码。可以使用少量伪代码来阐明核心逻辑。",
                "请提出至少两种解决方案（例如，一个临时修复 Quick Fix 和一个长期重构方案 Long-term Fix），并以表格形式对比它们的优缺点、风险和实施成本。",
                "请使用专业、清晰的中文进行回复。"
            ],
            "itemOrder": [ "main_content", "prompt_0", "prompt_1", "prompt_2", "prompt_3", "prompt_4" ]
        },
        {
            "name": "优化",
            "prompts": [
                "你是一位首席软件工程师和系统架构师，擅长代码审计、性能调优和产品策略分析。",
                "请对提供的代码库进行一次全面的审查，并从多个维度提出具体的优化建议。",
                "代码质量与可维护性: 识别代码异味（Code Smells）、重复代码（DRY原则）和过于复杂的函数。提出重构建议以提升代码的可读性和可维护性。",
                "性能瓶颈分析: 找出潜在的性能瓶颈，例如低效的算法、不当的数据库查询或内存泄漏风险，并提出优化方案。",
                "架构与设计模式: 评估项目的整体架构。指出不合理的设计、高耦合的模块，并建议更优的设计模式或架构方案以提高系统的可扩展性。",
                "技术债与未完成项: 扫描代码中的 `TODO`, `FIXME` 注释或明显的未完成逻辑，将其整理成一个清晰的技术债列表。",
                "用户体验 (UI/UX) 优化: 基于现有功能，从用户交互和界面设计的角度提出改进建议，例如简化操作流程、改善布局或提升可访问性。",
                "产品路线图建议: 根据项目当前的功能和目标，提出 3-5 个接下来最有价值开发的新功能，并说明它们为什么重要（例如：完善核心体验、吸引新用户）。",
                "请将所有发现的问题和建议整合到一个结构化的报告中。使用Markdown格式，并为每个条目评估其 优先级（高/中/低） 和 预估工作量（大/中/小）。",
                "本次审查专注于分析和建议，请不要输出任何修改后的代码块。",
                "请使用专业、客观且具有建设性的语言进行回复。"
            ],
            "itemOrder": [
                "main_content", "prompt_0", "prompt_1", "prompt_2", "prompt_3", "prompt_4", "prompt_5", "prompt_6", "prompt_7", "prompt_8", "prompt_9", "prompt_10"
            ]
        }
    ];

    /* --- 数据持久化函数 --- */
    const savePromptGroups = (data) => {
        try {
            localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(data));
        } catch (e) {
            console.error("GPH Error: Failed to save prompts.", e);
        }
    };

    const loadPromptGroups = () => {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY_PROMPTS);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                /* --- 确保每个组都有 itemOrder --- */
                parsedData.forEach(group => {
                    if (!group.itemOrder || !Array.isArray(group.itemOrder)) {
                        group.itemOrder = ['main_content', ...group.prompts.map((_, i) => `prompt_${i}`)];
                    }
                });
                return parsedData;
            }
        } catch (e) {
            console.error("GPH Error: Failed to load prompts from storage.", e);
        }
        return JSON.parse(JSON.stringify(DEFAULT_PROMPT_GROUPS)); /* --- 返回深拷贝的默认值 --- */
    };

    /* --- 加载提示词数据 --- */
    let promptGroups = loadPromptGroups();

    /* --- 更多状态变量 --- */
    let activeGroupIndex = 0;
    let originalContent = '';
    let isUpdatingByScript = false;
    let isAutoContinuing = false;
    let continueCount = 0;

    /* --- Trusted Types 适配：尽量获取/创建可用策略，失败则进入 DOM-only 模式 --- */
    let policy = null;
    try {
        if (window.trustedTypes) {
            if (typeof window.trustedTypes.getPolicyNames === 'function' && typeof window.trustedTypes.getPolicy === 'function') {
                const names = window.trustedTypes.getPolicyNames();
                for (const n of names) {
                    const p = window.trustedTypes.getPolicy(n);
                    if (p && typeof p.createHTML === 'function') {
                        policy = p;
                        break;
                    }
                }
            }
            if (!policy && typeof window.trustedTypes.createPolicy === 'function') {
                const candidates = ['ai-prompt-helper-policy-v17', 'gph-policy', 'bookmarklet-policy', 'default'];
                for (const name of candidates) {
                    try {
                        policy = window.trustedTypes.createPolicy(name, {createHTML: (s) => s});
                        break;
                    } catch (e) { /* --- 忽略，尝试下一个候选名 --- */
                    }
                }
            }
        }
    } catch (e) {
        policy = null;
    }

    /* --- 安全地设置HTML内容的函数 --- */
    const setSafeHTML = (element, html) => {
        while (element.firstChild) element.removeChild(element.firstChild);

        if (!html) return;
        if (policy && typeof policy.createHTML === 'function') {
            element.innerHTML = policy.createHTML(html);
            return;
        }

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString('<div id="__gph_wrap__">' + html + '</div>', 'text/html');
            const wrap = doc.getElementById('__gph_wrap__');
            if (wrap) {
                const frag = document.createDocumentFragment();
                Array.from(wrap.childNodes).forEach(node => frag.appendChild(node));
                element.appendChild(frag);
            }
        } catch (e) {
            element.textContent = html;
        }
    };

    /* --- HTML转义函数 --- */
    const escapeHTML = (str) => {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    };

    /* --- 截断并转义文本的函数 --- */
    const truncateAndEscapeText = (text, maxLines = 5) => {
        if (text.trim() === '') return '...';
        const lines = text.split('\n');
        const truncatedText = lines.length > maxLines ? lines.slice(0, maxLines).join('\n') + '\n...' : text;
        return escapeHTML(truncatedText);
    };

    /* --- 弹窗函数 --- */
    const showModal = ({title, message, type = 'info', onConfirm, onCancel}) => {
        const existingModal = document.getElementById('gph-modal-overlay');
        if (existingModal) existingModal.remove();

        const isConfirm = type === 'confirm';
        const modalId = 'gph-modal-overlay';

        const modalHTML = `
            <div id="gph-modal-container" role="dialog" aria-modal="true" aria-labelledby="gph-modal-title">
                <div id="gph-modal-header" class="${type}">
                    <h4 id="gph-modal-title">${title}</h4>
                    <button id="gph-modal-close" aria-label="关闭">&times;</button>
                </div>
                <div id="gph-modal-body"><p>${message}</p></div>
                <div id="gph-modal-footer">
                    ${isConfirm ? `<button id="gph-modal-cancel" class="gph-action-btn gph-secondary-btn">取消</button>` : ''}
                    <button id="gph-modal-ok" class="gph-action-btn">${isConfirm ? '确认' : '好的'}</button>
                </div>
            </div>`;

        const overlay = document.createElement('div');
        overlay.id = modalId;
        overlay.className = 'gph-modal-overlay';
        setSafeHTML(overlay, modalHTML);
        document.body.appendChild(overlay);

        const closeModal = () => {
            overlay.classList.add('fade-out');
            overlay.addEventListener('animationend', () => overlay.remove(), {once: true});
            document.removeEventListener('keydown', keydownHandler);
        };

        const keydownHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                if (onCancel) onCancel();
            }
        };

        overlay.addEventListener('click', (e) => {
            if (e.target.id === modalId) {
                closeModal();
                if (onCancel) onCancel();
            }
        });

        const okBtn = overlay.querySelector('#gph-modal-ok');
        const closeBtn = overlay.querySelector('#gph-modal-close');

        okBtn && okBtn.addEventListener('click', () => {
            closeModal();
            if (onConfirm) onConfirm();
        });

        closeBtn && closeBtn.addEventListener('click', () => {
            closeModal();
            if (onCancel) onCancel();
        });

        if (isConfirm) {
            const cancelBtn = overlay.querySelector('#gph-modal-cancel');
            cancelBtn && cancelBtn.addEventListener('click', () => {
                closeModal();
                if (onCancel) onCancel();
            });
        }

        document.addEventListener('keydown', keydownHandler);
        setTimeout(() => okBtn && okBtn.focus(), 50);
    };

    /* --- 如果未找到支持的输入框，则显示错误信息并退出 --- */
    if (!activeTextarea) {
        const tempStyleSheet = document.createElement("style");
        tempStyleSheet.innerText = `
        .gph-modal-overlay { --bg-primary: #2B2B2B; --bg-secondary: #3C3F41; --text-primary: #fcfcfc; --text-button: #DFDFDF; --text-handle: #6E6E6E; --border-primary: #4E5052; --accent-primary: #3675B4; --accent-secondary: #555555; --accent-delete: #C75450; --accent-success: #6A8759; --shadow-color: rgba(0,0,0,0.7); --overlay-bg: rgba(0,0,0,0.6); }
        @media (prefers-color-scheme: light) { .gph-modal-overlay { --bg-primary: #FFFFFF; --bg-secondary: #F2F2F2; --text-primary: #000000; --text-button: #FFFFFF; --text-handle: #AAAAAA; --border-primary: #DCDCDC; --accent-primary: #3966B2; --accent-secondary: #8C8C8C; --accent-delete: #DB5860; --accent-success: #34802E; --shadow-color: rgba(0,0,0,0.2); --overlay-bg: rgba(32,33,36,0.5); } }
        @keyframes gph-fade-in { from { opacity: 0; } to { opacity: 1; } } @keyframes gph-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .gph-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--overlay-bg); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: gph-fade-in 0.2s ease-out; font-family: sans-serif; }
        #gph-modal-container { background: var(--bg-primary); color: var(--text-primary); border-radius: 8px; box-shadow: 0 5px 20px var(--shadow-color); width: 90%; max-width: 400px; animation: gph-slide-up 0.3s ease-out; border-top: 4px solid var(--accent-delete); }
        #gph-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-primary); } #gph-modal-title { margin: 0; font-size: 16px; font-weight: bold; color: var(--accent-delete); }
        #gph-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-handle); display: none; }
        #gph-modal-body { padding: 16px; line-height: 1.6; } #gph-modal-body p { margin: 0; }
        #gph-modal-footer { padding: 12px 16px; background: var(--bg-secondary); display: none; justify-content: flex-end; gap: 10px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
        .gph-action-btn { background: var(--accent-primary); color: var(--text-button); border: 1px solid var(--accent-primary); border-radius: 4px; padding: 8px 20px; cursor: pointer; font-size: 13px; }`;
        document.head.appendChild(tempStyleSheet);

        showModal({
            title: '加载失败',
            message: '在当前页面未找到支持的AI输入框。脚本无法运行。<br>支持平台: Gemini, ChatGPT, DeepSeek等。<br><br>此窗口将在 <span id="gph-countdown" style="font-weight:bold;">5</span> 秒后自动关闭。',
            type: 'error'
        });

        let secondsLeft = 5;
        const countdownInterval = setInterval(() => {
            secondsLeft--;
            const countdownElement = document.getElementById('gph-countdown');
            if (countdownElement) {
                countdownElement.innerText = secondsLeft;
            }
            if (secondsLeft <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);

        setTimeout(() => {
            const modalOverlay = document.querySelector('.gph-modal-overlay');
            if (modalOverlay) {
                modalOverlay.remove();
            }
            clearInterval(countdownInterval);
        }, 5000);

        return;
    }

    /* --- CSS 样式：模仿IDEA配色，增加最小侵入性功能 --- */
    const styles = `
    /* --- IDEA Darcula-inspired Dark Theme --- */
    #gemini-mvp-helper, .gph-modal-overlay { --bg-primary: #2B2B2B; --bg-secondary: #3C3F41; --bg-header: #313335; --bg-input: #2B2B2B; --bg-dragging: #4E5052; --text-primary: #fcfcfc; --text-title: #fcfcfc; --text-button: #DFDFDF; --text-handle: #6E6E6E; --border-primary: #4E5052; --border-input: #555555; --accent-primary: #3675B4; --accent-secondary: #555555; --accent-delete: #C75450; --accent-delete-hover: #D76460; --accent-success: #6A8759; --shadow-color: rgba(0,0,0,0.7); --original-content-bg: rgba(43, 43, 43, 0.7); --original-content-border: #6E6E6E; --overlay-bg: rgba(0,0,0,0.6); }
    /* --- IDEA Light Theme --- */
    @media (prefers-color-scheme: light) { #gemini-mvp-helper, .gph-modal-overlay { --bg-primary: #FFFFFF; --bg-secondary: #F2F2F2; --bg-header: #EAEAEA; --bg-input: #FFFFFF; --bg-dragging: #D3E5FF; --text-primary: #000000; --text-title: #000000; --text-button: #FFFFFF; --text-handle: #AAAAAA; --border-primary: #DCDCDC; --border-input: #C9C9C9; --accent-primary: #3966B2; --accent-secondary: #8C8C8C; --accent-delete: #DB5860; --accent-delete-hover: #E86971; --accent-success: #34802E; --shadow-color: rgba(0,0,0,0.2); --original-content-bg: #E8F2FE; --original-content-border: #C9C9C9; --overlay-bg: rgba(32,33,36,0.5); } }
    
    /* --- Main Panel - Minimal Intrusion --- */
    #gemini-mvp-helper { position: fixed; bottom: 20px; right: 20px; width: 500px; background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: 8px; box-shadow: 0 4px 15px var(--shadow-color); z-index: 9999; color: var(--text-primary); font-family: sans-serif; display: flex; flex-direction: column; max-height: 80vh; resize: both; overflow: auto; min-width: 320px; min-height: 150px; opacity: 0.95; transition: opacity 0.2s ease-in-out; }
    #gemini-mvp-helper:hover, #gemini-mvp-helper.dragging-panel { opacity: 1; }
    
    /* --- Collapsed State --- */
    #gemini-mvp-helper.collapsed { height: auto; max-height: 45px; resize: none; overflow: hidden; }
    #gemini-mvp-helper.collapsed > *:not(#gph-mvp-header) { display: none; }
    #gemini-mvp-helper.collapsed #gph-mvp-toggle-collapse:before { content: '▲'; font-size: 10px; line-height: 14px; }
    
    /* --- Header with Controls --- */
    #gph-mvp-header { padding: 10px 15px; background: var(--bg-header); cursor: move; user-select: none; flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; }
    #gph-mvp-title { margin: 0; font-size: 14px; font-weight: normal; color: var(--text-title); }
    #gph-header-controls { display: flex; align-items: center; }
    #gph-mvp-toggle-collapse { background: var(--bg-secondary); border: 1px solid var(--border-primary); color: var(--text-handle); cursor: pointer; width: 20px; height: 20px; border-radius: 4px; font-size: 16px; line-height: 16px; padding: 0; display: flex; align-items: center; justify-content: center; }
    #gph-mvp-toggle-collapse:hover { background: var(--border-primary); }
    #gph-mvp-toggle-collapse:before { content: '▼'; font-size: 10px; line-height: 14px; }
    
    #gph-mvp-tabs { display: flex; background: var(--bg-secondary); padding: 5px 15px 0; border-bottom: 1px solid var(--border-primary); flex-shrink: 0; }
    .gph-mvp-tab { list-style: none; padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; font-size: 13px; }
    .gph-mvp-tab.active { border-bottom-color: var(--accent-primary); color: var(--text-primary); font-weight: bold; }
    #gph-mvp-body { padding: 15px; overflow-y: auto; }
    #gph-mvp-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .gph-mvp-item, .gph-original-content-item { display: flex; align-items: flex-start; background: var(--bg-secondary); padding: 8px; border-radius: 4px; border: 1px solid var(--border-primary); }
    .gph-mvp-item.dragging { opacity: 0.7; background: var(--bg-dragging); }
    .gph-original-content-item { background-color: var(--original-content-bg); border: 1px dashed var(--original-content-border); flex-direction: column; }
    #gph-original-content-text { font-style: italic; word-wrap: break-word; margin-top: 5px; width: 100%; white-space: pre-wrap; font-size: 12px; }
    .gph-drag-handle { cursor: grab; margin-right: 10px; color: var(--text-handle); user-select: none; padding-top: 2px; }
    .gph-mvp-item input[type="checkbox"] { margin-right: 10px; margin-top: 4px; flex-shrink: 0; }
    .gph-mvp-item-text { flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-top: 2px; font-size: 13px; }
    .gph-delete-btn { background: none; border: none; color: var(--accent-delete); cursor: pointer; font-size: 18px; padding: 0 5px; flex-shrink: 0; }
    .gph-delete-btn:hover { color: var(--accent-delete-hover); }
    #gph-mvp-add-area { padding: 15px; border-top: 1px solid var(--border-primary); background: var(--bg-secondary); display: flex; gap: 10px; flex-shrink: 0; }
    #gph-new-prompt-input { flex-grow: 1; background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary); border-radius: 4px; padding: 8px; font-size: 13px; }
    #gph-mvp-actions { padding: 15px; border-top: 1px solid var(--border-primary); display: flex; justify-content: space-between; gap: 10px; flex-shrink: 0; flex-wrap: wrap; }
    .gph-action-btn { background: var(--accent-primary); color: var(--text-button); border: 1px solid var(--accent-primary); border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 13px; flex-grow: 1; white-space: nowrap; }
    .gph-action-btn:hover { filter: brightness(1.1); }
    .gph-secondary-btn { background: var(--accent-secondary); border-color: var(--accent-secondary); }
    
    /* --- 新增：自动继续输入框和容器样式 --- */
    #gph-auto-continue-wrapper { display: flex; flex-grow: 1; }
    #gph-continue-times-input { background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary); width: 50px; text-align: center; font-size: 13px; border-radius: 4px 0 0 4px; border-right: none; padding: 6px; }
    #gph-continue-times-input:focus { outline: none; border-color: var(--accent-primary); }
    #gph-continue-times-input::-webkit-inner-spin-button, #gph-continue-times-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    #gph-continue-times-input { -moz-appearance: textfield; }
    #gph-auto-continue-btn { flex-grow: 1; border-radius: 0 4px 4px 0; }
    #gph-continue-counter { margin-left: 5px; font-weight: bold; }

    @keyframes gph-fade-in { from { opacity: 0; } to { opacity: 1; } } @keyframes gph-fade-out { from { opacity: 1; } to { opacity: 0; } } @keyframes gph-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .gph-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--overlay-bg); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: gph-fade-in 0.2s ease-out; }
    .gph-modal-overlay.fade-out { animation: gph-fade-out 0.2s ease-in forwards; }
    #gph-modal-container { background: var(--bg-primary); color: var(--text-primary); border-radius: 8px; box-shadow: 0 5px 20px var(--shadow-color); width: 90%; max-width: 400px; animation: gph-slide-up 0.3s ease-out; border-top: 4px solid var(--accent-primary); }
    #gph-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-primary); }
    #gph-modal-header.success { border-top-color: var(--accent-success); } #gph-modal-header.error { border-top-color: var(--accent-delete); } #gph-modal-header.confirm { border-top-color: var(--accent-secondary); }
    #gph-modal-title { margin: 0; font-size: 16px; font-weight: bold; color: var(--text-primary); }
    #gph-modal-header.success #gph-modal-title { color: var(--accent-success); } #gph-modal-header.error #gph-modal-title { color: var(--accent-delete); }
    #gph-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-handle); line-height: 1; padding: 0 4px; } #gph-modal-close:hover { color: var(--text-primary); }
    #gph-modal-body { padding: 16px; line-height: 1.6; } #gph-modal-body p { margin: 0; }
    #gph-modal-footer { padding: 12px 16px; background: var(--bg-secondary); display: flex; justify-content: flex-end; gap: 10px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
    #gph-modal-footer .gph-action-btn { flex-grow: 0; padding: 8px 20px; }`;

    /* --- HTML 结构：增加重置按钮 --- */
    const panelHTML = `
        <div id="gph-mvp-header">
            <h3 id="gph-mvp-title">快捷提示词</h3>
            <div id="gph-header-controls">
                <button id="gph-mvp-toggle-collapse" title="折叠/展开"></button>
            </div>
        </div>
        <ul id="gph-mvp-tabs"></ul>
        <div id="gph-mvp-body"><ul id="gph-mvp-list"></ul></div>
        <div id="gph-mvp-add-area">
            <input type="text" id="gph-new-prompt-input" placeholder="在此添加新提示词...">
            <button id="gph-add-prompt-btn" class="gph-action-btn">+</button>
        </div>
        <div id="gph-mvp-actions">
             <button id="gph-reset-btn" class="gph-action-btn gph-secondary-btn" title="恢复到初始默认提示词">重置</button>
             <button id="gph-copy-btn" class="gph-action-btn">复制代码</button>
             <div id="gph-auto-continue-wrapper">
                <input type="number" id="gph-continue-times-input" value="5" min="1" max="99" title="自动继续次数">
                <button id="gph-auto-continue-btn" class="gph-action-btn gph-secondary-btn">自动继续<span id="gph-continue-counter"></span></button>
             </div>
        </div>`;

    /* --- 注入样式和HTML到页面 --- */
    const styleSheet = document.createElement("style");
    styleSheet.id = styleId;
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    const panel = document.createElement('div');
    panel.id = panelId;
    setSafeHTML(panel, panelHTML);
    document.body.appendChild(panel);

    /* --- 面板状态持久化函数 --- */
    const savePanelState = () => {
        try {
            const state = {
                left: panel.style.left,
                top: panel.style.top,
                width: panel.style.width,
                height: panel.style.height,
            };
            localStorage.setItem(STORAGE_KEY_PANEL_STATE, JSON.stringify(state));
        } catch (e) {
            console.error("GPH Error: Failed to save panel state.", e);
        }
    };

    const loadPanelState = () => {
        try {
            const state = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL_STATE));
            if (state) {
                if(state.left) panel.style.left = state.left;
                if(state.top) panel.style.top = state.top;
                if(state.width) panel.style.width = state.width;
                if(state.height) panel.style.height = state.height;
            }
        } catch (e) {
            /* --- 忽略错误，使用默认位置 --- */
        }
    };

    /* --- 应用已保存的面板状态 --- */
    loadPanelState();

    /* --- 获取DOM元素引用 --- */
    const tabContainer = document.getElementById('gph-mvp-tabs');
    const promptList = document.getElementById('gph-mvp-list');
    const newPromptInput = document.getElementById('gph-new-prompt-input');
    const titleEl = document.getElementById('gph-mvp-title');
    const collapseBtn = document.getElementById('gph-mvp-toggle-collapse');

    if (titleEl) titleEl.textContent = `快捷提示词 (${activePlatform.name})`;
    if (collapseBtn) collapseBtn.addEventListener('click', () => panel.classList.toggle('collapsed'));

    /* --- 跨平台输入框内容获取函数 --- */
    const getInputValue = (element) => {
        if (!element) return '';
        if (element.isContentEditable) {
            return Array.from(element.querySelectorAll('p')).map(p => p.textContent).join('\n');
        }
        return element.value || element.textContent;
    };

    /* --- 跨平台输入框内容设置函数 --- */
    const setInputValue = (element, value) => {
        if (!element) return;
        if (element.isContentEditable) {
            const htmlValue = value.split('\n').map(line => `<p>${escapeHTML(line) || '<br>'}</p>`).join('');
            setSafeHTML(element, htmlValue);
        } else {
            element.value = value;
        }
        element.dispatchEvent(new Event('input', {bubbles: true, cancelable: true}));
    };

    /* --- 核心函数适配：使其操作当前激活的标签页数据 --- */
    const updateActiveTextarea = () => {
        if (!activeTextarea) return;

        const activeGroup = promptGroups[activeGroupIndex];
        const itemOrder = activeGroup.itemOrder;
        const prompts = activeGroup.prompts;

        isUpdatingByScript = true;
        const checkedIds = new Set(
            Array.from(promptList.querySelectorAll('input:checked')).map(cb => cb.closest('li').dataset.id)
        );
        const mainContentIndex = itemOrder.indexOf('main_content');
        const promptsBefore = [];
        const promptsAfter = [];

        itemOrder.forEach((id, index) => {
            if (id.startsWith('prompt_') && checkedIds.has(id)) {
                const promptIndex = parseInt(id.split('_')[1], 10);
                const targetArray = index < mainContentIndex ? promptsBefore : promptsAfter;
                targetArray.push(prompts[promptIndex]);
            }
        });

        const parts = [];
        if (promptsBefore.length > 0) parts.push(promptsBefore.join('\n\n'));
        if (originalContent.trim() !== '') parts.push(originalContent);
        if (promptsAfter.length > 0) parts.push(promptsAfter.join('\n\n'));
        setInputValue(activeTextarea, parts.join('\n\n'));
        requestAnimationFrame(() => {
            isUpdatingByScript = false;
        });
    };

    /* --- UI渲染：拆分为渲染整个UI（标签+列表）和仅渲染列表 --- */
    const renderPromptsForActiveGroup = (preserveChecks = false) => {
        const checkedIds = preserveChecks ? new Set(
            Array.from(promptList.querySelectorAll('input:checked')).map(cb => cb.closest('li').dataset.id)
        ) : new Set();

        const activeGroup = promptGroups[activeGroupIndex];
        const itemOrder = activeGroup.itemOrder;
        const prompts = activeGroup.prompts;

        setSafeHTML(promptList, '');

        itemOrder.forEach(id => {
            const li = document.createElement('li');
            li.dataset.id = id;
            if (id === 'main_content') {
                li.className = 'gph-original-content-item';
                setSafeHTML(li, `<strong>当前主要内容 (在输入框中编辑)</strong><div id="gph-original-content-text">${truncateAndEscapeText(originalContent, 5)}</div>`);
            } else {
                const index = parseInt(id.split('_')[1], 10);
                const promptText = prompts[index];
                li.className = 'gph-mvp-item';
                li.setAttribute('draggable', 'true');
                setSafeHTML(li, `<span class="gph-drag-handle">::</span><input type="checkbox" ${checkedIds.has(id) ? 'checked' : ''}><span class="gph-mvp-item-text" title="${escapeHTML(promptText)}">${escapeHTML(promptText)}</span><button class="gph-delete-btn">&times;</button>`);
            }
            promptList.appendChild(li);
        });
    };

    const renderUI = (preserveChecks = false) => {
        setSafeHTML(tabContainer, '');
        promptGroups.forEach((group, index) => {
            const tab = document.createElement('li');
            tab.className = 'gph-mvp-tab';
            if (index === activeGroupIndex) {
                tab.classList.add('active');
            }
            tab.textContent = group.name;
            tab.dataset.index = index;
            tabContainer.appendChild(tab);
        });

        /* --- 渲染当前激活页的提示词列表 --- */
        renderPromptsForActiveGroup(preserveChecks);
    };

    /* --- 添加新提示词的函数 --- */
    const addNewPrompt = () => {
        const text = newPromptInput.value.trim();
        if (text) {
            const activeGroup = promptGroups[activeGroupIndex];
            const newIndex = activeGroup.prompts.push(text) - 1;
            activeGroup.itemOrder.push(`prompt_${newIndex}`);
            newPromptInput.value = '';
            renderPromptsForActiveGroup(true);
            updateActiveTextarea();
            savePromptGroups(promptGroups);
            newPromptInput.focus(); /* --- UX优化：添加后自动聚焦 --- */
        }
    };

    /* --- 删除提示词的函数 --- */
    const deletePrompt = (idToDelete) => {
        const activeGroup = promptGroups[activeGroupIndex];

        activeGroup.itemOrder = activeGroup.itemOrder.filter(id => id !== idToDelete);

        const newPrompts = [];
        const newOrder = [];
        const oldToNewIndexMap = {};

        activeGroup.itemOrder.forEach(id => {
            if (id === 'main_content') {
                newOrder.push(id);
            } else {
                const oldIndex = parseInt(id.split('_')[1], 10);
                if (oldToNewIndexMap[oldIndex] === undefined) {
                    oldToNewIndexMap[oldIndex] = newPrompts.push(activeGroup.prompts[oldIndex]) - 1;
                }
                newOrder.push(`prompt_${oldToNewIndexMap[oldIndex]}`);
            }
        });

        activeGroup.prompts = newPrompts;
        activeGroup.itemOrder = newOrder;

        renderPromptsForActiveGroup(true);
        updateActiveTextarea();
        savePromptGroups(promptGroups);
    };

    /* --- 全选/反选函数（移到面板点击事件处理器中）--- */

    /* --- 适配函数：复制书签代码时序列化整个 promptGroups --- */
    const copyBookmarkletCode = () => {
        const updatedSource = main.toString().replace(
            /const DEFAULT_PROMPT_GROUPS = \[[\s\S]*?\];/,
            `const DEFAULT_PROMPT_GROUPS = ${JSON.stringify(promptGroups, null, 4)};`
        );
        navigator.clipboard.writeText(`javascript:(${updatedSource})()`).then(() => {
            showModal({title: '操作成功', message: '新版书签代码已复制到剪贴板！', type: 'success'});
        }).catch(() => {
            showModal({title: '操作失败', message: '无法复制到剪贴板。', type: 'error'});
        });
    };

    /* --- 自动继续功能核心逻辑 --- */
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * 新增：平滑滚动到聊天窗口底部的函数
     */
    const scrollToBottom = () => {
        if (!activePlatform || !activePlatform.scrollContainerSelector) {
            console.warn('GPH Warn: 当前平台未配置滚动容器选择器。');
            return;
        }

        const container = document.querySelector(activePlatform.scrollContainerSelector);
        if (container) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            console.warn(`GPH Warn: 未找到滚动容器: "${activePlatform.scrollContainerSelector}"`);
        }
    };

    const stopAutoContinue = () => {
        isAutoContinuing = false;
        continueCount = 0;
        const continueBtn = document.getElementById('gph-auto-continue-btn');
        const counterSpan = document.getElementById('gph-continue-counter');
        if (continueBtn) continueBtn.firstChild.textContent = '自动继续'; /* --- 只修改文本节点 --- */
        if (counterSpan) counterSpan.textContent = '';
        console.log('自动继续任务已停止。');
    };

    async function startAutoContinue() {
        const continueBtn = document.getElementById('gph-auto-continue-btn');
        const counterSpan = document.getElementById('gph-continue-counter');

        while (continueCount > 0 && isAutoContinuing) {
            continueBtn.firstChild.textContent = '停止';
            counterSpan.textContent = `(${continueCount})`;

            console.log('等待AI开始生成...');
            let stoppableButton = document.querySelector(activePlatform.stoppableSelector);
            while (!stoppableButton && isAutoContinuing) {
                await sleep(500);
                stoppableButton = document.querySelector(activePlatform.stoppableSelector);
            }
            if (!isAutoContinuing) break;

            console.log('AI正在生成，等待结束...');
            while (document.querySelector(activePlatform.stoppableSelector) && isAutoContinuing) {
                await sleep(500);
            }
            if (!isAutoContinuing) break;

            console.log('AI生成结束。');

            await sleep(1000);
            const sendButton = document.querySelector(activePlatform.sendButtonSelector);
            if (!sendButton) {
                console.error('未找到发送按钮，停止任务。');
                showModal({title: '错误', message: '找不到发送按钮，自动继续已停止。', type: 'error'});
                break;
            }

            while ((sendButton.disabled || sendButton.getAttribute('aria-disabled') === 'true') && isAutoContinuing) {
                setInputValue(activeTextarea, '继续');
                console.log('执行“继续”操作...');

                scrollToBottom();

                await sleep(500);
            }
            if (!isAutoContinuing) break;

            sendButton.click();

            continueCount--;
        }

        stopAutoContinue();
    }

    /* --- 面板拖拽逻辑 --- */
    const header = document.getElementById('gph-mvp-header');
    let isDraggingPanel = false, offsetX, offsetY;
    header.addEventListener('mousedown', (e) => {
        isDraggingPanel = true;
        panel.classList.add('dragging-panel');
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
        document.body.style.cursor = 'move';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDraggingPanel) return;
        panel.style.left = `${e.clientX - offsetX}px`;
        panel.style.top = `${e.clientY - offsetY}px`;
    });
    document.addEventListener('mouseup', () => {
        if (isDraggingPanel) {
            isDraggingPanel = false;
            panel.classList.remove('dragging-panel');
            document.body.style.cursor = 'default';
            savePanelState(); /* --- 保存位置 --- */
        }
    });

    /* --- 监听面板大小变化 --- */
    if (window.ResizeObserver) {
        new ResizeObserver(savePanelState).observe(panel);
    }

    /* --- 提示词拖拽排序逻辑 --- */
    let draggedItem = null;
    promptList.addEventListener('dragstart', (e) => {
        const item = e.target.closest('li[draggable="true"]');
        if (item) {
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
        }
    });
    promptList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetItem = e.target.closest('li');
        if (targetItem && targetItem !== draggedItem) {
            const rect = targetItem.getBoundingClientRect();
            promptList.insertBefore(draggedItem, e.clientY > rect.top + rect.height / 2 ? targetItem.nextSibling : targetItem);
        }
    });
    promptList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            const activeGroup = promptGroups[activeGroupIndex];
            activeGroup.itemOrder = Array.from(promptList.querySelectorAll('li')).map(li => li.dataset.id);
            renderPromptsForActiveGroup(true);
            updateActiveTextarea();
            savePromptGroups(promptGroups); /* --- 保存排序 --- */
        }
    });

    /* --- 面板内所有点击事件的统一处理器 --- */
    panel.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'gph-add-prompt-btn') addNewPrompt();
        else if (target.classList.contains('gph-delete-btn')) {
            showModal({
                title: '请确认', message: '您确定要永久删除这条提示词吗？', type: 'confirm',
                onConfirm: () => deletePrompt(target.closest('li').dataset.id)
            });
        } else if (target.id === 'gph-reset-btn') {
            showModal({
                title: '请确认', message: '此操作将清除所有自定义提示词，并恢复到初始默认设置。确定要继续吗？', type: 'confirm',
                onConfirm: () => {
                    localStorage.removeItem(STORAGE_KEY_PROMPTS);
                    promptGroups = loadPromptGroups(); /* --- 重新加载默认值 --- */
                    renderUI();
                    updateActiveTextarea();
                }
            });
        }
        else if (target.id === 'gph-copy-btn') copyBookmarkletCode();
        else if (target.id === 'gph-auto-continue-btn') {
            if (isAutoContinuing) {
                stopAutoContinue();
            } else {
                const timesInput = document.getElementById('gph-continue-times-input');
                const times = timesInput ? timesInput.value : '0';
                const num = parseInt(times, 10);

                if (num && num > 0) {
                    continueCount = num;
                    isAutoContinuing = true;
                    showModal({
                        title: '任务准备就绪',
                        message: `请手动发送您的初始请求。脚本将在AI开始生成后接管，并自动继续 ${num} 次。`,
                        type: 'info'
                    });
                    startAutoContinue();
                }
            }
        }
    });

    /* --- 事件监听：增加标签页点击事件 --- */
    tabContainer.addEventListener('click', (e) => {
        const tab = e.target.closest('.gph-mvp-tab');
        if (tab && !tab.classList.contains('active')) {
            const newIndex = parseInt(tab.dataset.index, 10);
            activeGroupIndex = newIndex;
            renderUI();
        }
    });

    /* --- 监听提示词列表的复选框变化 --- */
    promptList.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') updateActiveTextarea();
    });

    /* --- 监听新提示词输入框的回车事件 --- */
    newPromptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addNewPrompt();
        }
    });

    /* --- 这部分逻辑与UI分组无关，保持不变 --- */
    const syncInputToState = () => {
        if (isUpdatingByScript || !activeTextarea) return;
        const currentValue = getInputValue(activeTextarea);

        if (originalContent.trim() !== '') {
            promptList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
        }

        const allKnownPrompts = new Set();
        promptGroups.forEach(group => group.prompts.forEach(p => allKnownPrompts.add(p)));

        const userContentBlocks = currentValue.split('\n\n').filter(block => !allKnownPrompts.has(block.trim()));
        const newOriginalContent = userContentBlocks.join('\n\n');

        if (newOriginalContent !== originalContent) {
            originalContent = newOriginalContent;
            const contentDiv = document.getElementById('gph-original-content-text');
            if (contentDiv) setSafeHTML(contentDiv, truncateAndEscapeText(originalContent, 5));
        }
    };

    /* --- 确保输入框绑定，处理SPA页面切换输入框实例的情况 --- */
    const ensureTextareaBinding = () => {
        if (activeTextarea && document.body.contains(activeTextarea)) {
            return;
        }

        const newTextarea = document.querySelector(activePlatform.selector);

        if (newTextarea !== activeTextarea) {
            if (activeTextarea) {
                activeTextarea.removeEventListener('input', syncInputToState);
                activeTextarea.removeEventListener('blur', syncInputToState);
            }
            activeTextarea = newTextarea;
            if (activeTextarea) {
                activeTextarea.addEventListener('input', syncInputToState);
                activeTextarea.addEventListener('blur', syncInputToState);
                syncInputToState();
            }
        } else if (!newTextarea) {
            activeTextarea = null;
        }
    };

    /* --- 初始化：为每个分组生成 itemOrder (已移至加载函数中) --- */

    /* --- 初始绑定和渲染 --- */
    activeTextarea.addEventListener('input', syncInputToState);
    activeTextarea.addEventListener('blur', syncInputToState);

    setInterval(ensureTextareaBinding, 1000);

    syncInputToState();
    renderUI(); /* --- 初始渲染调用 renderUI --- */
})()