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
    const STORAGE_KEY_FRAMEWORKS = 'gph_roleFrameworks_v2';
    const STORAGE_KEY_PANEL_STATE = 'gph_panelState_v1';
    const STORAGE_KEY_GENERAL_PROMPTS = 'gph_generalPrompts_v1'; /* --- 新增：通用提示词存储KEY --- */

    /* --- AI平台配置 (已集成自动继续所需的选择器) --- */
    const AI_PLATFORMS = [
        {name: 'AIStudio', hostname: 'aistudio.google.com', selector: 'ms-prompt-box textarea', sendButtonSelector: 'ms-run-button button[aria-label="Run"]', stoppableSelector: 'ms-run-button button:has(span.spin)', scrollContainerSelector: '.chat-view-container'},
        {name: 'Gemini', hostname: 'gemini.google.com', selector: 'rich-textarea .ql-editor[contenteditable="true"]', sendButtonSelector: '[aria-label="Send message"]', stoppableSelector: '[aria-label="Stop generating"]', scrollContainerSelector: 'ms-autoscroll-container'},
        {name: 'ChatGPT', hostname: 'chatgpt.com', selector: '#prompt-textarea', sendButtonSelector: 'button[data-testid="send-button"]', stoppableSelector: 'button[aria-label*="Stop"]', scrollContainerSelector: 'main .overflow-y-auto'},
        {name: 'DeepSeek', hostname: 'chat.deepseek.com', selector: 'textarea#chat-input', sendButtonSelector: 'button[class*="send-btn"]', stoppableSelector: 'button[class*="stop-btn"]', scrollContainerSelector: 'div.custom-scroll-container'},
    ];

    /* --- 元提示词模板：要求AI直接输出JSON (v2.1: 支持自定义数量) --- */
    const META_PROMPT_TEMPLATE = `
#### **你的身份**
你是一位顶级的提示词工程师（Prompt Engineering Architect），同时也是一个精准的JSON格式化工具。你的任务是根据我提供的一个特定【领域/主题】，设计一个全面、结构化、多角色的AI助手提示词框架，并**直接以一个完整的JSON对象格式**输出。禁止在JSON代码块前后添加任何解释性文字、开场白或总结。

#### **核心指令**
根据我提供的【领域/主题】，你必须严格按照以下JSON结构和要求，生成内容。

**JSON结构示例：**
\`\`\`json
{
  "name": "AI [领域/主题] 助手框架",
  "domain": "[领域/主题]",
  "commonDirectives": {
    "identity": "你是一个世界级的[领域/主题]专家团队...",
    "rules": [
      "回答必须结构清晰、逻辑严谨。",
      "所有角色的回答都必须包含固定的结构化标签，例如：【多维度考量】、【时效性提醒】和【自我修正指令】。"
    ]
  },
  "roles": [
    {
      "name": "[角色1名称]",
      "description": "何时使用此角色：[简要说明场景]",
      "definition": "[详细的角色身份、专长和核心目标描述]",
      "directives": [
        "[具体、可操作的任务指令1]",
        "[具体、可操作的任务指令2]"
      ],
      "considerations": [
        { "text": "【分析维度1】", "enabled": true },
        { "text": "【分析维度2】", "enabled": true }
      ],
      "timeliness": "[与领域相关的时效性提醒，必须包含占位符 '[模型训练截止日期]']",
      "selfCorrection": [
        "如果我说'[典型反馈1]'，你应该...",
        "如果我说'[典型反馈2]'，你应该..."
      ],
      "personalizationProfiles": [
        {
          "profileName": "[配置项名称1，例如：沟通语调]",
          "ui": "radio",
          "options": [
            { "optionName": "[选项1]", "directive": "[选中此选项时注入的指令文本]", "default": true },
            { "optionName": "[选项2]", "directive": "[选中此选项时注入的指令文本]", "default": false },
            { "optionName": "[选项3]", "directive": "[选中此选项时注入的指令文本]", "default": false }
          ]
        },
        {
          "profileName": "[配置项名称2，例如：风险倾向]",
          "ui": "radio",
          "options": [
            { "optionName": "[选项A]", "directive": "[选中此选项时注入的指令文本]", "default": true },
            { "optionName": "[选项B]", "directive": "[选中此选项时注入的指令文本]", "default": false }
          ]
        }
      ]
    }
  ]
}
\`\`\`

**生成要求：**
1.  **顶级键**: 必须包含 \`name\`, \`domain\`, \`commonDirectives\`, 和 \`roles\`。
2.  **\`name\` 和 \`domain\`**: 其中的 "[领域/主题]" 需替换为我提供的具体内容。
3.  **\`roles\`**: 必须是一个包含 **[ROLE_COUNT]个** 角色对象的数组。
4.  **内容数量**: 对于数组中的每一个角色对象：
    *   \`directives\` 数组中必须包含 **[DIRECTIVES_COUNT]个** 指令字符串。
    *   \`considerations\` 数组中必须包含 **[CONSIDERATIONS_COUNT]个** 维度对象。
    *   \`personalizationProfiles\` 数组中必须包含 **[PERSONALIZATION_COUNT]个** 配置项对象。
5.  **结构遵循**: 所有生成的键名和数据结构必须严格遵循上面的JSON示例。特别是 \`personalizationProfiles\` 及其内部的 \`options\` 结构必须完整，每个配置项至少有3个选项。
6.  **最终输出**: 你的回复**必须且只能是**一个符合上述结构的JSON代码块。不要添加 "好的，这是您要的JSON" 之类的话。

**现在，请为我提供的以下【领域/主题】生成这个框架的JSON内容：**
`;

    /* --- 脚本状态变量 ---  */
    let activePlatform = null;
    const currentHostname = window.location.hostname + window.location.pathname;
    let isAutoContinuing = false;
    let continueCount = 0;
    let isGeneralModeActive = false; /* --- 新增：通用模式状态 --- */

    /* --- 新增：动态获取当前活动输入框的函数 --- */
    const getActiveTextarea = () => {
        if (!activePlatform) return null;
        return document.querySelector(activePlatform.selector);
    };

    /* --- 查找当前页面匹配的AI平台 --- */
    for (const platform of AI_PLATFORMS) {
        if (currentHostname.includes(platform.hostname)) {
            if (document.querySelector(platform.selector)) {
                activePlatform = platform;
                break;
            }
        }
    }

    /* --- 如果未找到支持的平台，则显示错误信息并退出 --- */
    if (!activePlatform) {
        alert('在当前页面未找到支持的AI输入框。脚本无法运行。\n支持平台: Gemini, ChatGPT, DeepSeek等。');
        return;
    }

    /* --- 数据持久化函数 --- */
    const saveFrameworks = (data) => {
        try { localStorage.setItem(STORAGE_KEY_FRAMEWORKS, JSON.stringify(data)); } catch (e) { console.error("GPH Error: Failed to save frameworks.", e); }
    };
    const loadFrameworks = () => {
        try { const storedData = localStorage.getItem(STORAGE_KEY_FRAMEWORKS); return storedData ? JSON.parse(storedData) : []; } catch (e) { console.error("GPH Error: Failed to load frameworks.", e); return []; }
    };
    /* --- 新增：通用提示词持久化函数 --- */
    const saveGeneralPrompts = (data) => {
        try { localStorage.setItem(STORAGE_KEY_GENERAL_PROMPTS, JSON.stringify(data)); } catch (e) { console.error("GPH Error: Failed to save general prompts.", e); }
    };
    const loadGeneralPrompts = () => {
        try { const storedData = localStorage.getItem(STORAGE_KEY_GENERAL_PROMPTS); return storedData ? JSON.parse(storedData) : []; } catch (e) { console.error("GPH Error: Failed to load general prompts.", e); return []; }
    };


    /* --- 加载数据 --- */
    let frameworks = loadFrameworks();
    let generalPrompts = loadGeneralPrompts(); /* --- 新增：加载通用提示词 --- */

    /* --- 更多状态变量 --- */
    let activeFrameworkIndex = frameworks.length > 0 ? 0 : -1;
    let activeRoleIndex = 0;

    /* --- Trusted Types 适配和 setSafeHTML 函数 --- */
    let policy = null;
    try {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
            policy = window.trustedTypes.createPolicy('gph-policy#default', { createHTML: string => string });
        }
    } catch (e) { /* --- 忽略 --- */ }

    const setSafeHTML = (element, html) => {
        if (policy) {
            element.innerHTML = policy.createHTML(html);
        } else {
            while (element.firstChild) element.removeChild(element.firstChild);
            const template = document.createElement('template');
            template.innerHTML = html;
            element.appendChild(template.content);
        }
    };

    /* --- Bug修复：创建安全的HTML追加函数 --- */
    const appendSafeHTML = (element, html) => {
        const template = document.createElement('template');
        if (policy) {
            template.innerHTML = policy.createHTML(html);
        } else {
            template.innerHTML = html;
        }
        element.appendChild(template.content);
    };

    /* --- HTML转义函数 --- */
    const escapeHTML = (str) => {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    };

    /* --- 弹窗函数 --- */
    const showModal = ({title, contentHTML, onConfirm, onCancel, confirmText = '确认', cancelText = '取消', showCancel = true}) => {
        const existingModal = document.getElementById('gph-modal-overlay');
        if (existingModal) existingModal.remove();

        const modalContainer = document.createElement('div');
        modalContainer.id = 'gph-modal-container';
        modalContainer.setAttribute('role', 'dialog');
        modalContainer.setAttribute('aria-modal', 'true');
        modalContainer.setAttribute('aria-labelledby', 'gph-modal-title');

        const modalContent = `
            <div id="gph-modal-header">
                <h4 id="gph-modal-title">${escapeHTML(title)}</h4>
                <button id="gph-modal-close" aria-label="关闭">&times;</button>
            </div>
            <div id="gph-modal-body"></div>
            <div id="gph-modal-footer">
                ${showCancel ? `<button id="gph-modal-cancel" class="gph-action-btn gph-secondary-btn">${escapeHTML(cancelText)}</button>` : ''}
                <button id="gph-modal-ok" class="gph-action-btn">${escapeHTML(confirmText)}</button>
            </div>`;

        setSafeHTML(modalContainer, modalContent);
        setSafeHTML(modalContainer.querySelector('#gph-modal-body'), contentHTML);

        const overlay = document.createElement('div');
        overlay.id = 'gph-modal-overlay';
        overlay.className = 'gph-modal-overlay';
        overlay.appendChild(modalContainer);
        document.body.appendChild(overlay);

        const closeModal = () => {
            const okBtn = overlay.querySelector('#gph-modal-ok');
            okBtn.replaceWith(okBtn.cloneNode(true));
            overlay.remove();
        };

        overlay.querySelector('#gph-modal-ok').addEventListener('click', () => {
            if(onConfirm) onConfirm(overlay, closeModal);
        });
        if(showCancel) overlay.querySelector('#gph-modal-cancel').addEventListener('click', () => { if(onCancel) onCancel(); closeModal(); });
        overlay.querySelector('#gph-modal-close').addEventListener('click', () => { if(onCancel) onCancel(); closeModal(); });

        return overlay;
    };

    /* --- CSS 样式 --- */
    const styles = `
    #gemini-mvp-helper, .gph-modal-overlay { --bg-primary: #2B2B2B; --bg-secondary: #3C3F41; --bg-header: #313335; --bg-input: #2B2B2B; --text-primary: #fcfcfc; --text-title: #fcfcfc; --text-secondary: #bbbbbb; --text-button: #DFDFDF; --border-primary: #4E5052; --border-input: #555555; --accent-primary: #3675B4; --accent-secondary: #555555; --shadow-color: rgba(0,0,0,0.7); --overlay-bg: rgba(0,0,0,0.6); }
    @media (prefers-color-scheme: light) { #gemini-mvp-helper, .gph-modal-overlay { --bg-primary: #FFFFFF; --bg-secondary: #F2F2F2; --bg-header: #EAEAEA; --bg-input: #FFFFFF; --text-primary: #000000; --text-title: #000000; --text-secondary: #555555; --text-button: #FFFFFF; --border-primary: #DCDCDC; --border-input: #C9C9C9; --accent-primary: #3966B2; --accent-secondary: #8C8C8C; --shadow-color: rgba(0,0,0,0.2); --overlay-bg: rgba(32,33,36,0.5); } }
    #gemini-mvp-helper { position: fixed; bottom: 20px; right: 20px; width: 550px; background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: 8px; box-shadow: 0 4px 15px var(--shadow-color); z-index: 9999; color: var(--text-primary); font-family: sans-serif; display: flex; flex-direction: column; max-height: 85vh; resize: both; overflow: auto; min-width: 350px; min-height: 200px; }
    #gph-header { padding: 10px 15px; background: var(--bg-header); cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
    #gph-title { margin: 0; font-size: 14px; font-weight: normal; color: var(--text-title); }
    #gph-framework-manager { display: flex; gap: 10px; padding: 10px 15px; border-bottom: 1px solid var(--border-primary); align-items: center; flex-shrink: 0; flex-wrap: wrap; }
    #gph-framework-selector { flex-grow: 1; background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary); border-radius: 4px; padding: 8px; font-size: 13px; }
    .gph-action-btn { background: var(--accent-primary); color: var(--text-button); border: 1px solid var(--accent-primary); border-radius: 4px; padding: 8px 12px; cursor: pointer; font-size: 13px; white-space: nowrap; }
    .gph-action-btn:hover { filter: brightness(1.1); }
    .gph-secondary-btn { background: var(--accent-secondary); border-color: var(--accent-secondary); }
    #gph-body { padding: 15px; overflow-y: auto; flex-grow: 1; }
    #gph-role-tabs { display: flex; border-bottom: 1px solid var(--border-primary); margin-bottom: 15px; flex-wrap: wrap; }
    .gph-role-tab { list-style: none; padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; font-size: 13px; color: var(--text-secondary); }
    .gph-role-tab.active { border-bottom-color: var(--accent-primary); color: var(--text-primary); font-weight: bold; }
    #gph-general-tab { margin-left: auto; border-left: 1px solid var(--border-primary); } /* --- 新增：通用页签样式 --- */
    #gph-general-prompts-container { display: flex; flex-wrap: wrap; gap: 10px; } /* --- 新增：通用提示词容器样式 --- */
    .gph-general-prompt-btn { flex-grow: 1; text-align: left;    white-space: nowrap;      /* 1. 防止文本换行 */overflow: hidden;         /* 2. 隐藏溢出的部分 */text-overflow: ellipsis;  /* 3. 将溢出部分显示为省略号 */} /* --- 新增：通用提示词按钮样式 --- */
    .gph-role-section { margin-bottom: 15px; }
    .gph-role-section h5 { margin: 0 0 8px 0; font-size: 14px; color: var(--text-title); border-bottom: 1px solid var(--border-primary); padding-bottom: 5px; }
    .gph-profile-group { margin-bottom: 12px; } .gph-profile-group:last-child { margin-bottom: 0; }
    .gph-profile-group h6 { margin: 0 0 6px 0; font-size: 13px; color: var(--text-primary); font-weight: normal; }
    .gph-radio-item { display: flex; align-items: center; margin-bottom: 4px; font-size: 13px; color: var(--text-secondary); }
    .gph-radio-item input[type="radio"] { margin-right: 8px; accent-color: var(--accent-primary); }
    .gph-radio-item label { cursor: pointer; }
    .gph-role-section p, .gph-role-section ul { margin: 0; padding: 0; font-size: 13px; color: var(--text-secondary); list-style: none; }
    .gph-checklist-item { display: flex; align-items: flex-start; margin-bottom: 5px; }
    .gph-checklist-item input { margin-right: 8px; margin-top: 3px; }
    .gph-checklist-item label { word-break: break-word; }
    #gph-welcome-screen { text-align: center; padding: 40px 20px; }
    #gph-welcome-screen h4 { margin: 0 0 10px; }
    #gph-welcome-screen p { margin-bottom: 20px; color: var(--text-secondary); font-size: 13px; }
    #gph-footer { padding: 10px 15px; border-top: 1px solid var(--border-primary); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-shrink: 0; background-color: var(--bg-secondary); }
    #gph-auto-continue-wrapper { display: flex; }
    #gph-continue-times-input { background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary); width: 50px; text-align: center; font-size: 13px; border-radius: 4px 0 0 4px; border-right: none; padding: 6px; }
    #gph-continue-times-input:focus { outline: none; border-color: var(--accent-primary); }
    #gph-continue-times-input::-webkit-inner-spin-button, #gph-continue-times-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    #gph-continue-times-input { -moz-appearance: textfield; }
    #gph-auto-continue-btn { border-radius: 0 4px 4px 0; }
    #gph-continue-counter { margin-left: 5px; font-weight: bold; }
    @keyframes gph-fade-in { from { opacity: 0; } to { opacity: 1; } } @keyframes gph-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .gph-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--overlay-bg); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: gph-fade-in 0.2s ease-out; }
    #gph-modal-container { background: var(--bg-primary); color: var(--text-primary); border-radius: 8px; box-shadow: 0 5px 20px var(--shadow-color); width: 90%; max-width: 700px; animation: gph-slide-up 0.3s ease-out; display: flex; flex-direction: column; max-height: 85vh; }
    #gph-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-primary); flex-shrink: 0; }
    #gph-modal-title { margin: 0; font-size: 16px; font-weight: bold; }
    #gph-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-secondary); }
    #gph-modal-body { padding: 16px; line-height: 1.6; overflow-y: auto; }
    #gph-modal-body label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500;}
    #gph-modal-body input, #gph-modal-body textarea { width: 100%; background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary); border-radius: 4px; padding: 8px; font-size: 13px; box-sizing: border-box; margin-bottom: 12px; }
    #gph-modal-body input[type="checkbox"], #gph-modal-body input[type="radio"] { width: auto; margin-right: 8px; }
    #gph-modal-body textarea { min-height: 80px; resize: vertical; }
    #gph-modal-footer { padding: 12px 16px; background: var(--bg-secondary); display: flex; justify-content: flex-end; gap: 10px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; flex-shrink: 0; }
    #gph-modal-footer .gph-action-btn { flex-grow: 0; }
    .gph-manage-list { list-style: none; padding: 0; margin: 0; }
    .gph-manage-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px; border-bottom: 1px solid var(--border-primary); gap: 10px; }
    .gph-manage-item:last-child { border-bottom: none; }
    .gph-manage-item-name { flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gph-manage-item-buttons { display: flex; gap: 8px; flex-shrink: 0; }
    .gph-manage-item-buttons .gph-action-btn { padding: 5px 10px; font-size: 12px; }
    .gph-edit-section { border: 1px solid var(--border-primary); border-radius: 6px; padding: 12px; margin-bottom: 16px; }
    .gph-edit-section > legend { padding: 0 8px; font-weight: bold; color: var(--text-title); }
    .gph-dynamic-list { display: flex; flex-direction: column; gap: 8px; }
    .gph-dynamic-list-item { display: flex; align-items: center; gap: 8px; }
    .gph-dynamic-list-item input[type="text"] { flex-grow: 1; margin-bottom: 0; }
    .gph-dynamic-list-item-multi { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: center; padding: 8px; background: var(--bg-secondary); border-radius: 4px; }
    .gph-dynamic-list-item-multi > div { display: flex; flex-direction: column; }
    .gph-dynamic-list-item-multi label { margin-bottom: 4px; font-size: 11px; }
    .gph-dynamic-list-item-multi input { margin-bottom: 0; }
    .gph-dynamic-list-btn { padding: 4px 8px; font-size: 12px; min-width: 30px; }
    .gph-add-btn-wrapper { margin-top: 8px; }
    .gph-edit-accordion details { border-bottom: 1px solid var(--border-primary); margin-bottom: 8px; }
    .gph-edit-accordion details:last-child { border-bottom: none; }
    .gph-edit-accordion summary { font-weight: bold; cursor: pointer; padding: 10px 0; list-style: none; display: flex; justify-content: space-between; align-items: center; }
    .gph-edit-accordion summary::-webkit-details-marker { display: none; }
    .gph-edit-accordion summary::before { content: '▶'; margin-right: 8px; }
    .gph-edit-accordion details[open] > summary::before { content: '▼'; }
    .gph-edit-accordion-content { padding: 0 10px 10px; }
    `;

    /* --- HTML 结构 --- */
    const panel = document.createElement('div');
    panel.id = panelId;
    const panelContent = `
        <div id="gph-header">
            <h3 id="gph-title">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <style>
                    .bg { fill: url(#logo-gradient); } .grad-stop-1 { stop-color: #007ACC; } .grad-stop-2 { stop-color: #009688; } .main-element { fill: white; fill-opacity: 0.9; }
                    @media (prefers-color-scheme: dark) { .bg { fill: #2D3748; } .grad-stop-1, .grad-stop-2 { stop-color: transparent; } .main-element { fill: #D1D5DB; fill-opacity: 1; } }
                </style>
                <defs>
                    <linearGradient id="logo-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                        <stop class="grad-stop-1"/> <stop offset="1" class="grad-stop-2"/>
                    </linearGradient>
                </defs>
                <g id="icon-multi-role-framework">
                    <rect width="64" height="64" rx="12" class="bg"/>
                    <g class="main-element">
                        <rect x="30" y="38" width="4" height="8" rx="2"/> <rect x="22.5" y="27" width="8" height="4" rx="2" transform="rotate(-60 26.5 29)"/> <rect x="33.5" y="27" width="8" height="4" rx="2" transform="rotate(60 37.5 29)"/>
                        <circle cx="32" cy="50" r="6"/> <circle cx="18" cy="26" r="6"/> <circle cx="46" cy="26" r="6"/>
                        <path d="M32 28 L37.2 31 L37.2 37 L32 40 L26.8 37 L26.8 31 Z"/>
                    </g>
                </g>
            </svg>
            AI 多角色框架助手 (${escapeHTML(activePlatform.name)})
            </h3>
        </div>
        <div id="gph-framework-manager">
            <select id="gph-framework-selector"></select>
            <button id="gph-new-framework-btn" class="gph-action-btn" title="生成元提示词">+</button>
            <button id="gph-paste-json-btn" class="gph-action-btn gph-secondary-btn" title="粘贴AI返回的JSON创建框架">粘贴JSON</button>
            <button id="gph-manage-framework-btn" class="gph-action-btn gph-secondary-btn">管理框架</button>
            <button id="gph-manage-general-btn" class="gph-action-btn gph-secondary-btn">管理通用</button> <!--- 新增：管理通用提示词按钮 --->
        </div>
        <div id="gph-body"></div>
        <div id="gph-footer">
            <div id="gph-auto-continue-wrapper">
                <input type="number" id="gph-continue-times-input" value="5" min="1" max="99" title="自动继续次数">
                <button id="gph-auto-continue-btn" class="gph-action-btn gph-secondary-btn">自动继续<span id="gph-continue-counter"></span></button>
            </div>
            <button id="gph-combine-send-btn" class="gph-action-btn">组合并发送</button>
        </div>
    `;
    setSafeHTML(panel, panelContent);
    document.body.appendChild(panel);

    /* --- 注入样式 --- */
    const styleSheet = document.createElement("style");
    styleSheet.id = styleId;
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    /* --- 面板状态持久化 --- */
    const savePanelState = () => { try { localStorage.setItem(STORAGE_KEY_PANEL_STATE, JSON.stringify({ left: panel.style.left, top: panel.style.top, width: panel.style.width, height: panel.style.height })); } catch (e) { /* --- 忽略 --- */ } };
    const loadPanelState = () => { try { const state = JSON.parse(localStorage.getItem(STORAGE_KEY_PANEL_STATE)); if (state) { Object.assign(panel.style, state); } } catch (e) { /* --- 忽略 --- */ } };
    loadPanelState();

    /* --- 获取DOM元素引用 --- */
    const bodyEl = panel.querySelector('#gph-body');
    const frameworkSelector = panel.querySelector('#gph-framework-selector');

    /* --- 跨平台输入框操作函数 --- */
    const setInputValue = (element, value, append = false) => {
        const currentContent = append ? getInputValue(element) : '';
        const newContent = append ? `${currentContent}\n${value}`.trim() : value;
        if (element.isContentEditable) {
            setSafeHTML(element, newContent.split('\n').map(line => `<p>${escapeHTML(line) || '<br>'}</p>`).join(''));
        } else {
            element.value = newContent;
        }
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    };

    /* --- UI 渲染函数 --- */
    const renderUI = () => {
        /* --- 根据模式显示/隐藏相关控件 --- */
        const frameworkControls = ['#gph-new-framework-btn', '#gph-paste-json-btn', '#gph-manage-framework-btn', '#gph-combine-send-btn'];
        const generalControls = ['#gph-manage-general-btn'];
        frameworkControls.forEach(sel => panel.querySelector(sel).style.display = isGeneralModeActive ? 'none' : 'inline-block');
        generalControls.forEach(sel => panel.querySelector(sel).style.display = isGeneralModeActive ? 'inline-block' : 'none');

        /* --- Bug修复：统一渲染页签，确保所有页签始终可见 --- */
        let roleTabsHTML = '';
        if (frameworks.length > 0 && frameworks[activeFrameworkIndex]) {
            const framework = frameworks[activeFrameworkIndex];
            roleTabsHTML = framework.roles.map((r, i) =>
                `<li class="gph-role-tab ${!isGeneralModeActive && i === activeRoleIndex ? 'active' : ''}" data-index="${i}">${escapeHTML(r.name)}</li>`
            ).join('');
        }
        const generalTabHTML = `<li id="gph-general-tab" class="gph-role-tab ${isGeneralModeActive ? 'active' : ''}">通用指令</li>`;
        const fullTabsHTML = `<ul id="gph-role-tabs">${roleTabsHTML}${generalTabHTML}</ul>`;

        let bodyContentHTML = '';

        if (isGeneralModeActive) {
            /* --- 渲染通用模式主体 --- */
            panel.querySelector('#gph-framework-selector').style.display = 'none';
            if (generalPrompts.length === 0) {
                bodyContentHTML = `<div id="gph-welcome-screen"><h4>无通用指令</h4><p>点击【管理通用】按钮来添加您的第一个快捷指令。</p></div>`;
            } else {
                const promptsHTML = generalPrompts.map((p, i) =>
                    `<button class="gph-action-btn gph-secondary-btn gph-general-prompt-btn" data-index="${i}" title="${escapeHTML(p.prompt)}">${escapeHTML(p.name)}</button>`
                ).join('');
                bodyContentHTML = `<div id="gph-general-prompts-container">${promptsHTML}</div>`;
            }
        } else {
            /* --- 渲染框架模式主体 --- */
            panel.querySelector('#gph-framework-selector').style.display = 'inline-block';
            if (frameworks.length === 0) {
                bodyContentHTML = `<div id="gph-welcome-screen"><h4>无可用框架</h4><p>点击 "+" 向AI请求生成框架JSON，<br>然后点击【粘贴JSON】来创建您的第一个框架。</p></div>`;
                setSafeHTML(frameworkSelector, '<option>无可用框架</option>');
                frameworkSelector.disabled = true;
                panel.querySelector('#gph-manage-framework-btn').style.display = 'none';
                panel.querySelector('#gph-combine-send-btn').style.display = 'none';
            } else {
                frameworkSelector.disabled = false;
                panel.querySelector('#gph-manage-framework-btn').style.display = 'inline-block';
                panel.querySelector('#gph-combine-send-btn').style.display = 'inline-block';

                const selectorHTML = frameworks.map((f, i) => `<option value="${i}" ${i === activeFrameworkIndex ? 'selected' : ''}>${escapeHTML(f.name)}</option>`).join('');
                setSafeHTML(frameworkSelector, selectorHTML);

                const framework = frameworks[activeFrameworkIndex];
                const activeRole = framework.roles[activeRoleIndex];

                if (activeRole) {
                    const directivesHTML = activeRole.directives.map((d, i) => `<li class="gph-checklist-item"><input type="checkbox" id="dir-${i}" data-index="${i}" checked><label for="dir-${i}">${escapeHTML(d)}</label></li>`).join('');
                    const considerationsHTML = activeRole.considerations.map((c, i) => `<li class="gph-checklist-item"><input type="checkbox" id="con-${i}" data-index="${i}" checked><label for="con-${i}">${escapeHTML(c.text)}</label></li>`).join('');

                    let personalizationHTML = '';
                    if (Array.isArray(activeRole.personalizationProfiles) && activeRole.personalizationProfiles.length > 0) {
                        personalizationHTML = `<div id="gph-personalization-section" class="gph-role-section">
                                                <h5>个性化配置</h5>
                                                ${activeRole.personalizationProfiles.map((profile, profileIndex) => {
                            const radioGroupName = `gph-profile-${profileIndex}-${profile.profileName.replace(/\s+/g, '-')}`;
                            return `<div class="gph-profile-group">
                                                                <h6>${escapeHTML(profile.profileName)}</h6>
                                                                ${profile.options.map((option, optionIndex) => `
                                                                    <div class="gph-radio-item">
                                                                        <input type="radio" id="prof-${profileIndex}-${optionIndex}" name="${radioGroupName}" 
                                                                               data-profile-index="${profileIndex}" data-option-index="${optionIndex}" ${option.default ? 'checked' : ''}>
                                                                        <label for="prof-${profileIndex}-${optionIndex}">${escapeHTML(option.optionName)}</label>
                                                                    </div>
                                                                `).join('')}
                                                            </div>`;
                        }).join('')}
                                               </div>`;
                    }
                    bodyContentHTML = `
                        <div id="gph-role-details">
                            <div class="gph-role-section"><h5>使用场景</h5><p>${escapeHTML(activeRole.description)}</p></div>
                            <div class="gph-role-section"><h5>角色定义</h5><p>${escapeHTML(activeRole.definition)}</p></div>
                            <div class="gph-role-section"><h5>核心指令 (勾选以包含)</h5><ul id="gph-directives-list">${directivesHTML}</ul></div>
                            <div class="gph-role-section"><h5>多维度考量 (勾选以包含)</h5><ul id="gph-considerations-list">${considerationsHTML}</ul></div>
                            ${personalizationHTML}
                        </div>`;
                } else {
                    bodyContentHTML = '<div>请选择一个角色。</div>';
                }
            }
        }

        setSafeHTML(bodyEl, fullTabsHTML + bodyContentHTML);
    };

    /* --- 核心工作流函数 --- */
    const handleGenerateFramework = () => {
        showModal({
            title: '创建新框架',
            contentHTML: `
                <label for="gph-domain-input">请输入领域/主题：</label>
                <input type="text" id="gph-domain-input" placeholder="例如：软件开发项目重构" style="margin-bottom: 15px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 15px;">
                    <div>
                        <label for="gph-role-count-input" style="margin-bottom: 4px;">角色数量:</label>
                        <input type="number" id="gph-role-count-input" value="3" min="2" max="5">
                    </div>
                    <div>
                        <label for="gph-directives-count-input" style="margin-bottom: 4px;">核心指令数:</label>
                        <input type="number" id="gph-directives-count-input" value="3" min="1" max="5">
                    </div>
                    <div>
                        <label for="gph-considerations-count-input" style="margin-bottom: 4px;">考量维度数:</label>
                        <input type="number" id="gph-considerations-count-input" value="3" min="1" max="5">
                    </div>
                    <div>
                        <label for="gph-personalization-count-input" style="margin-bottom: 4px;">个性化配置数:</label>
                        <input type="number" id="gph-personalization-count-input" value="2" min="1" max="4">
                    </div>
                </div>`,
            onConfirm: (modal, closeModal) => {
                const domain = modal.querySelector('#gph-domain-input').value.trim();
                if (!domain) return;

                const roleCount = parseInt(modal.querySelector('#gph-role-count-input').value, 10) || 3;
                const directivesCount = parseInt(modal.querySelector('#gph-directives-count-input').value, 10) || 3;
                const considerationsCount = parseInt(modal.querySelector('#gph-considerations-count-input').value, 10) || 3;
                const personalizationCount = parseInt(modal.querySelector('#gph-personalization-count-input').value, 10) || 2;

                const finalPrompt = META_PROMPT_TEMPLATE
                    .replace('[ROLE_COUNT]', roleCount)
                    .replace('[DIRECTIVES_COUNT]', directivesCount)
                    .replace('[CONSIDERATIONS_COUNT]', considerationsCount)
                    .replace('[PERSONALIZATION_COUNT]', personalizationCount);

                const textarea = getActiveTextarea();
                if (!textarea) {
                    showModal({ title: '错误', contentHTML: '<p>无法找到AI输入框，请刷新页面或在新会话中重试。</p>', showCancel: false, confirmText: '关闭', onConfirm: (modal, closeModal) => closeModal()  });
                    return;
                }
                setInputValue(textarea, finalPrompt + domain);
                closeModal();

                document.querySelector(activePlatform.sendButtonSelector)?.click();
                setTimeout(() => {
                    document.querySelector(activePlatform.sendButtonSelector)?.click();
                    showModal({
                        title: '操作指南',
                        contentHTML: `<p>元提示词已发送给AI。</p><p>请等待AI完全生成JSON内容后，<strong>手动复制完整的JSON代码块</strong>，然后点击面板上的【粘贴JSON】按钮来创建新框架。</p>`,
                        showCancel: false, confirmText: '我明白了',
                        onConfirm: (modal, closeModal) => closeModal()
                    });
                }, 500);
            }
        });
    };

    const handlePasteAndCreateFramework = () => {
        const contentHTML = `<p>请将AI生成的、包含JSON代码块的文本粘贴到下方。</p><textarea id="gph-json-paste-area" rows="10" placeholder="在此处粘贴..."></textarea>`;
        showModal({
            title: '从JSON创建新框架', contentHTML: contentHTML, confirmText: '创建',
            onConfirm: (modal, closeModal) => {
                let rawText = modal.querySelector('#gph-json-paste-area').value.trim();
                if (!rawText) return;

                const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
                const jsonString = jsonMatch ? jsonMatch[1] : (rawText.startsWith('{') ? rawText : null);

                closeModal();

                if (!jsonString) {
                    showModal({ title: '提取失败', contentHTML: `<p>未能在您粘贴的文本中找到有效的JSON代码块 (以 \`\`\`json 开头或直接以 { 开头)。</p>`, showCancel: false, confirmText: '关闭' , onConfirm: (modal, closeModal) => closeModal() });
                    return;
                }

                try {
                    const newFrameworkData = JSON.parse(jsonString);
                    if (!newFrameworkData.name || !Array.isArray(newFrameworkData.roles) || newFrameworkData.roles.length === 0) throw new Error('JSON结构无效，缺少 "name" 或 "roles" 数组。');

                    newFrameworkData.id = `framework_${Date.now()}`;
                    newFrameworkData.createdAt = new Date().toISOString();
                    frameworks.push(newFrameworkData);
                    activeFrameworkIndex = frameworks.length - 1;
                    activeRoleIndex = 0;
                    saveFrameworks(frameworks);
                    renderUI();
                    showModal({ title: '成功', contentHTML: `<p>成功创建了新的 <strong>${escapeHTML(newFrameworkData.name)}</strong> 框架！</p>`, showCancel: false, confirmText: '好的', onConfirm: (modal, closeModal) => closeModal() });
                } catch (error) {
                    showModal({ title: '解析失败', contentHTML: `<p>无法解析提取出的JSON内容。请检查其格式是否正确。</p><p><strong>错误信息:</strong> ${escapeHTML(error.message)}</p>`, showCancel: false, confirmText: '关闭', onConfirm: (modal, closeModal) => closeModal()  });
                }
            }
        });
    };

    const showGranularEditModal = (indexToEdit) => {
        const framework = JSON.parse(JSON.stringify(frameworks[indexToEdit]));

        const createDynamicListHTML = (items, type) => {
            let html = '';
            if (type === 'string') {
                html = items.map(item => `
                    <div class="gph-dynamic-list-item" data-type="string">
                        <input type="text" value="${escapeHTML(item)}">
                        <button type="button" class="gph-action-btn gph-secondary-btn gph-dynamic-list-btn gph-delete-item-btn">-</button>
                    </div>`).join('');
            } else if (type === 'consideration') {
                html = items.map(item => `
                    <div class="gph-dynamic-list-item" data-type="consideration">
                        <input type="text" value="${escapeHTML(item.text || '')}" placeholder="维度文本">
                        <input type="checkbox" ${item.enabled ? 'checked' : ''}>
                        <button type="button" class="gph-action-btn gph-secondary-btn gph-dynamic-list-btn gph-delete-item-btn">-</button>
                    </div>`).join('');
            }
            return html;
        };

        const createPersonalizationOptionHTML = (option, profileIndex, optionIndex) => `
             <div class="gph-dynamic-list-item-multi" data-type="option" data-profile-index="${profileIndex}">
                 <div>
                     <label>选项名称</label>
                     <input type="text" class="edit-option-name" value="${escapeHTML(option.optionName || '')}">
                 </div>
                 <div>
                     <label>注入指令</label>
                     <input type="text" class="edit-option-directive" value="${escapeHTML(option.directive || '')}">
                 </div>
                 <div style="text-align: center;">
                     <label>默认?</label>
                     <input type="radio" name="default-option-${profileIndex}" ${option.default ? 'checked' : ''}>
                     <button type="button" class="gph-action-btn gph-secondary-btn gph-dynamic-list-btn gph-delete-item-btn">-</button>
                 </div>
             </div>`;

        let contentHTML = `
            <form id="gph-edit-form">
                <fieldset class="gph-edit-section">
                    <legend>基础信息</legend>
                    <label for="edit-framework-name">框架名称</label>
                    <input type="text" id="edit-framework-name" value="${escapeHTML(framework.name)}">
                    <label for="edit-framework-domain">领域/主题</label>
                    <input type="text" id="edit-framework-domain" value="${escapeHTML(framework.domain)}">
                </fieldset>
                
                <fieldset class="gph-edit-section">
                    <legend>通用指令</legend>
                    <label for="edit-common-identity">身份 (Identity)</label>
                    <textarea id="edit-common-identity">${escapeHTML(framework.commonDirectives.identity)}</textarea>
                    <label>规则 (Rules)</label>
                    <div class="gph-dynamic-list" id="edit-common-rules">
                        ${createDynamicListHTML(framework.commonDirectives.rules, 'string')}
                    </div>
                    <div class="gph-add-btn-wrapper">
                        <button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-target="edit-common-rules" data-type="string">+</button>
                    </div>
                </fieldset>

                <fieldset class="gph-edit-section">
                    <legend>角色配置</legend>
                    <div class="gph-edit-accordion" id="edit-roles-accordion">
                    ${framework.roles.map((role, roleIndex) => `
                        <details class="gph-role-item" data-role-index="${roleIndex}">
                            <summary>${escapeHTML(role.name)} <button type="button" class="gph-action-btn gph-secondary-btn gph-delete-item-btn" style="font-size:12px; padding: 2px 6px;">删除此角色</button></summary>
                            <div class="gph-edit-accordion-content">
                                <label>角色名称</label><input type="text" class="edit-role-name" value="${escapeHTML(role.name)}">
                                <label>描述</label><textarea class="edit-role-description">${escapeHTML(role.description)}</textarea>
                                <label>定义</label><textarea class="edit-role-definition">${escapeHTML(role.definition)}</textarea>
                                
                                <label>核心指令</label>
                                <div class="gph-dynamic-list" data-role-list="directives">
                                    ${createDynamicListHTML(role.directives, 'string')}
                                </div>
                                <div class="gph-add-btn-wrapper">
                                    <button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="string">+</button>
                                </div>
                                
                                <label style="margin-top: 12px;">多维度考量</label>
                                <div class="gph-dynamic-list" data-role-list="considerations">
                                    ${createDynamicListHTML(role.considerations, 'consideration')}
                                </div>
                                <div class="gph-add-btn-wrapper">
                                    <button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="consideration">+</button>
                                </div>
                                
                                <label style="margin-top: 12px;">时效性提醒</label><input type="text" class="edit-role-timeliness" value="${escapeHTML(role.timeliness)}">
                                
                                <label style="margin-top: 12px;">自我修正</label>
                                <div class="gph-dynamic-list" data-role-list="selfCorrection">
                                    ${createDynamicListHTML(role.selfCorrection, 'string')}
                                </div>
                                <div class="gph-add-btn-wrapper">
                                    <button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="string">+</button>
                                </div>
                                
                                <div style="margin-top: 12px;">
                                    <label>个性化配置</label>
                                    <div class="gph-personalization-profiles-list" data-role-list="personalizationProfiles">
                                    ${(role.personalizationProfiles || []).map((profile, profileIndex) => `
                                        <fieldset class="gph-edit-section" data-profile-index="${profileIndex}">
                                            <legend>配置项 <button type="button" class="gph-action-btn gph-secondary-btn gph-delete-item-btn" style="font-size:12px; padding: 2px 6px;">-</button></legend>
                                            <label>配置名称</label><input type="text" class="edit-profile-name" value="${escapeHTML(profile.profileName)}">
                                            <label>选项</label>
                                            <div class="gph-dynamic-list">
                                                ${(profile.options || []).map((opt, optIndex) => createPersonalizationOptionHTML(opt, profileIndex, optIndex)).join('')}
                                            </div>
                                            <div class="gph-add-btn-wrapper">
                                                <button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="option" data-profile-index="${profileIndex}">+ 添加选项</button>
                                            </div>
                                        </fieldset>
                                    `).join('')}
                                    </div>
                                    <div class="gph-add-btn-wrapper">
                                        <button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="profile">+ 添加配置项</button>
                                    </div>
                                </div>
                            </div>
                        </details>`).join('')}
                    </div>
                    <div class="gph-add-btn-wrapper">
                        <button type="button" id="gph-add-role-btn" class="gph-action-btn">+ 添加新角色</button>
                    </div>
                </fieldset>
            </form>
        `;

        const modal = showModal({
            title: `编辑: ${framework.name}`,
            contentHTML,
            confirmText: '保存更改',
            onConfirm: (modalInstance, closeModal) => {
                const newFramework = {};
                const form = modalInstance.querySelector('#gph-edit-form');

                newFramework.name = form.querySelector('#edit-framework-name').value;
                newFramework.domain = form.querySelector('#edit-framework-domain').value;
                newFramework.commonDirectives = {
                    identity: form.querySelector('#edit-common-identity').value,
                    rules: Array.from(form.querySelectorAll('#edit-common-rules .gph-dynamic-list-item input')).map(el => el.value)
                };

                newFramework.roles = Array.from(form.querySelectorAll('#edit-roles-accordion .gph-role-item')).map(roleEl => {
                    const role = {
                        name: roleEl.querySelector('.edit-role-name').value,
                        description: roleEl.querySelector('.edit-role-description').value,
                        definition: roleEl.querySelector('.edit-role-definition').value,
                        timeliness: roleEl.querySelector('.edit-role-timeliness').value,
                    };
                    role.directives = Array.from(roleEl.querySelectorAll('[data-role-list="directives"] input')).map(el => el.value);
                    role.selfCorrection = Array.from(roleEl.querySelectorAll('[data-role-list="selfCorrection"] input')).map(el => el.value);
                    role.considerations = Array.from(roleEl.querySelectorAll('[data-role-list="considerations"] .gph-dynamic-list-item')).map(conEl => ({
                        text: conEl.querySelector('input[type="text"]').value,
                        enabled: conEl.querySelector('input[type="checkbox"]').checked
                    }));
                    role.personalizationProfiles = Array.from(roleEl.querySelectorAll('[data-role-list="personalizationProfiles"] > fieldset')).map((profEl) => {
                        const profile = {
                            profileName: profEl.querySelector('.edit-profile-name').value,
                            ui: 'radio'
                        };
                        profile.options = Array.from(profEl.querySelectorAll('.gph-dynamic-list-item-multi')).map(optEl => ({
                            optionName: optEl.querySelector('.edit-option-name').value,
                            directive: optEl.querySelector('.edit-option-directive').value,
                            default: optEl.querySelector('input[type="radio"]').checked
                        }));
                        return profile;
                    });
                    return role;
                });

                frameworks[indexToEdit] = newFramework;
                saveFrameworks(frameworks);
                renderUI();
                closeModal();
                showModal({ title: '成功', contentHTML: `<p>框架 <strong>${escapeHTML(newFramework.name)}</strong> 已成功更新！</p>`, showCancel: false, confirmText: '好的', onConfirm: (modal, closeModal) => closeModal()  });
            }
        });

        modal.querySelector('#gph-modal-body').addEventListener('click', e => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.matches('.gph-delete-item-btn')) {
                target.closest('.gph-dynamic-list-item, .gph-dynamic-list-item-multi, details, fieldset[data-profile-index]').remove();
            } else if (target.matches('.gph-add-item-btn')) {
                const type = target.dataset.type;
                const container = target.closest('.gph-add-btn-wrapper').previousElementSibling;
                let newItemHTML = '';
                if (type === 'string') {
                    newItemHTML = `<div class="gph-dynamic-list-item" data-type="string"><input type="text" value=""><button type="button" class="gph-action-btn gph-secondary-btn gph-dynamic-list-btn gph-delete-item-btn">-</button></div>`;
                } else if (type === 'consideration') {
                    newItemHTML = `<div class="gph-dynamic-list-item" data-type="consideration"><input type="text" placeholder="维度文本"><input type="checkbox" checked><button type="button" class="gph-action-btn gph-secondary-btn gph-dynamic-list-btn gph-delete-item-btn">-</button></div>`;
                } else if (type === 'option') {
                    const profileIndex = target.dataset.profileIndex;
                    newItemHTML = createPersonalizationOptionHTML({}, profileIndex, container.children.length);
                } else if (type === 'profile') {
                    const profileIndex = container.children.length;
                    newItemHTML = `<fieldset class="gph-edit-section" data-profile-index="${profileIndex}">
                        <legend>配置项 <button type="button" class="gph-action-btn gph-secondary-btn gph-delete-item-btn" style="font-size:12px; padding: 2px 6px;">-</button></legend>
                        <label>配置名称</label><input type="text" class="edit-profile-name" value="新配置">
                        <label>选项</label>
                        <div class="gph-dynamic-list"></div>
                        <div class="gph-add-btn-wrapper">
                           <button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="option" data-profile-index="${profileIndex}">+ 添加选项</button>
                        </div>
                    </fieldset>`;
                }
                if (newItemHTML) appendSafeHTML(container, newItemHTML);
            } else if (target.id === 'gph-add-role-btn') {
                const accordion = document.getElementById('edit-roles-accordion');
                const roleIndex = accordion.children.length;
                const newRoleHTML = `
                    <details class="gph-role-item" data-role-index="${roleIndex}" open>
                        <summary>新角色 <button type="button" class="gph-action-btn gph-secondary-btn gph-delete-item-btn" style="font-size:12px; padding: 2px 6px;">删除此角色</button></summary>
                         <div class="gph-edit-accordion-content">
                             <label>角色名称</label><input type="text" class="edit-role-name" value="新角色">
                             <label>描述</label><textarea class="edit-role-description"></textarea>
                             <label>定义</label><textarea class="edit-role-definition"></textarea>
                             <label>核心指令</label><div class="gph-dynamic-list" data-role-list="directives"></div><div class="gph-add-btn-wrapper"><button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="string">+</button></div>
                             <label style="margin-top: 12px;">多维度考量</label><div class="gph-dynamic-list" data-role-list="considerations"></div><div class="gph-add-btn-wrapper"><button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="consideration">+</button></div>
                             <label style="margin-top: 12px;">时效性提醒</label><input type="text" class="edit-role-timeliness" value="">
                             <label style="margin-top: 12px;">自我修正</label><div class="gph-dynamic-list" data-role-list="selfCorrection"></div><div class="gph-add-btn-wrapper"><button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="string">+</button></div>
                             <div style="margin-top: 12px;"><label>个性化配置</label><div class="gph-personalization-profiles-list" data-role-list="personalizationProfiles"></div><div class="gph-add-btn-wrapper"><button type="button" class="gph-action-btn gph-secondary-btn gph-add-item-btn" data-type="profile">+ 添加配置项</button></div></div>
                         </div>
                    </details>`;
                appendSafeHTML(accordion, newRoleHTML);
            }
        });

        modal.querySelector('#gph-modal-body').addEventListener('input', e => {
            if (e.target.matches('.edit-role-name')) {
                const newName = e.target.value;
                const summary = e.target.closest('details').querySelector('summary');
                summary.childNodes[0].nodeValue = newName + ' ';
            }
        });
    };

    const handleCombineAndSend = () => {
        if (activeFrameworkIndex < 0) return;
        const framework = frameworks[activeFrameworkIndex];
        const role = framework.roles[activeRoleIndex];

        const textarea = getActiveTextarea();
        if (!textarea) {
            showModal({ title: '错误', contentHTML: '<p>无法找到AI输入框，请刷新页面或在新会话中重试。</p>', showCancel: false, confirmText: '关闭' , onConfirm: (modal, closeModal) => closeModal() });
            return;
        }

        const checkedDirectives = Array.from(bodyEl.querySelectorAll('#gph-directives-list input:checked')).map(cb => role.directives[cb.dataset.index]);
        const checkedConsiderations = Array.from(bodyEl.querySelectorAll('#gph-considerations-list input:checked')).map(cb => role.considerations[cb.dataset.index].text);

        const personalizationDirectives = Array.from(bodyEl.querySelectorAll('#gph-personalization-section input[type="radio"]:checked'))
            .map(radio => {
                const profileIndex = parseInt(radio.dataset.profileIndex, 10);
                const optionIndex = parseInt(radio.dataset.optionIndex, 10);
                return role.personalizationProfiles[profileIndex]?.options[optionIndex]?.directive;
            })
            .filter(Boolean);

        const promptParts = [
            framework.commonDirectives.identity,
            ...framework.commonDirectives.rules,
            `\n# 当前角色：${role.name}\n${role.definition}`
        ];
        if (checkedDirectives.length > 0) promptParts.push(`\n## 核心指令：\n- ${checkedDirectives.join('\n- ')}`);

        if (personalizationDirectives.length > 0) promptParts.push(`\n## 个性化指令：\n- ${personalizationDirectives.join('\n- ')}`);

        const originalContent = getInputValue(textarea);
        if (originalContent.trim()) promptParts.push(`\n## 任务内容：\n${originalContent}`);
        if (checkedConsiderations.length > 0) promptParts.push(`\n## 输出要求：\n请在你的回答中，必须包含对以下维度的深入分析：\n- ${checkedConsiderations.join('\n- ')}`);

        promptParts.push(`\n---\n${role.timeliness}\n\n${role.selfCorrection.join('\n')}`);

        setInputValue(textarea, promptParts.join('\n\n'));
        document.querySelector(activePlatform.sendButtonSelector)?.click();
    };
    /* --- 跨平台获取输入框内容函数 --- */
    const getInputValue = (element) => {
        if (!element) return '';
        if (element.isContentEditable) {
            return element.innerText;
        }
        return element.value;
    };
    const handleManageFrameworks = () => {
        const getManageListHTML = () => {
            if (frameworks.length === 0) return '<p>没有可管理的框架。</p>';
            return `<ul class="gph-manage-list">${frameworks.map((f, i) => `
                <li class="gph-manage-item" data-index="${i}">
                    <span class="gph-manage-item-name" title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</span>
                    <div class="gph-manage-item-buttons">
                        <button class="gph-action-btn gph-edit-btn">编辑</button>
                        <button class="gph-action-btn gph-secondary-btn gph-delete-btn">删除</button>
                    </div>
                </li>`).join('')}</ul>`;
        };

        const modal = showModal({
            title: '管理框架',
            contentHTML: getManageListHTML(),
            showCancel: false,
            confirmText: '关闭',
            onConfirm: (modalInstance, closeModal) => closeModal()
        });

        const modalBody = modal.querySelector('#gph-modal-body');
        modalBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.gph-edit-btn');
            const deleteBtn = e.target.closest('.gph-delete-btn');
            const item = e.target.closest('.gph-manage-item');

            if (!item) return;
            const index = parseInt(item.dataset.index, 10);

            if (editBtn) {
                showGranularEditModal(index);
            } else if (deleteBtn) {
                const frameworkToDelete = frameworks[index];
                showModal({
                    title: '确认删除',
                    contentHTML: `<p>你确定要删除框架 <strong>"${escapeHTML(frameworkToDelete.name)}"</strong> 吗？此操作无法撤销。</p>`,
                    confirmText: '确认删除',
                    onConfirm: (confirmModal, closeConfirmModal) => {
                        frameworks.splice(index, 1);
                        if (frameworks.length === 0) {
                            activeFrameworkIndex = -1;
                        } else {
                            activeFrameworkIndex = Math.min(activeFrameworkIndex, frameworks.length - 1);
                        }
                        saveFrameworks(frameworks);
                        renderUI();

                        setSafeHTML(modalBody, getManageListHTML());
                        closeConfirmModal();
                    }
                });
            }
        });
    };

    /* --- 新增：通用提示词管理函数 --- */
    const handleManageGeneralPrompts = () => {
        const showEditPromptModal = (index = -1) => {
            const isEditing = index > -1;
            const prompt = isEditing ? generalPrompts[index] : { name: '', prompt: '' };
            showModal({
                title: isEditing ? '编辑通用指令' : '新增通用指令',
                contentHTML: `
                    <label for="gph-prompt-name">指令名称 (按钮上显示):</label>
                    <input type="text" id="gph-prompt-name" value="${escapeHTML(prompt.name)}">
                    <label for="gph-prompt-content">指令内容:</label>
                    <textarea id="gph-prompt-content" rows="6">${escapeHTML(prompt.prompt)}</textarea>`,
                confirmText: '保存',
                onConfirm: (modal, closeModal) => {
                    const name = modal.querySelector('#gph-prompt-name').value.trim();
                    const content = modal.querySelector('#gph-prompt-content').value.trim();
                    if (!name || !content) return;

                    const newPrompt = { name: name, prompt: content };
                    if (isEditing) {
                        generalPrompts[index] = newPrompt;
                    } else {
                        generalPrompts.push(newPrompt);
                    }
                    saveGeneralPrompts(generalPrompts);
                    closeModal();
                    handleManageGeneralPrompts();
                    renderUI();
                }
            });
        };

        const getManageListHTML = () => {
            if (generalPrompts.length === 0) return '<p>没有可管理的通用指令。</p>';
            return `<ul class="gph-manage-list">${generalPrompts.map((p, i) => `
                <li class="gph-manage-item" data-index="${i}">
                    <span class="gph-manage-item-name" title="${escapeHTML(p.prompt)}">${escapeHTML(p.name)}</span>
                    <div class="gph-manage-item-buttons">
                        <button class="gph-action-btn gph-edit-general-btn">编辑</button>
                        <button class="gph-action-btn gph-secondary-btn gph-delete-general-btn">删除</button>
                    </div>
                </li>`).join('')}</ul>`;
        };

        const modal = showModal({
            title: '管理通用指令',
            contentHTML: `${getManageListHTML()}<div class="gph-add-btn-wrapper" style="text-align:right; margin-top:20px;"><button id="gph-add-new-general-btn" class="gph-action-btn">新增指令</button></div>`,
            showCancel: false,
            confirmText: '关闭',
            onConfirm: (modalInstance, closeModal) => closeModal()
        });

        const modalBody = modal.querySelector('#gph-modal-body');
        modalBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.gph-edit-general-btn');
            const deleteBtn = e.target.closest('.gph-delete-general-btn');
            const addBtn = e.target.closest('#gph-add-new-general-btn');
            const item = e.target.closest('.gph-manage-item');

            if (addBtn) {
                showEditPromptModal();
            } else if (item) {
                const index = parseInt(item.dataset.index, 10);
                if (editBtn) {
                    showEditPromptModal(index);
                } else if (deleteBtn) {
                    showModal({
                        title: '确认删除',
                        contentHTML: `<p>你确定要删除指令 <strong>"${escapeHTML(generalPrompts[index].name)}"</strong> 吗？</p>`,
                        confirmText: '确认删除',
                        onConfirm: (_, closeConfirmModal) => {
                            generalPrompts.splice(index, 1);
                            saveGeneralPrompts(generalPrompts);
                            setSafeHTML(modalBody, `${getManageListHTML()}<div class="gph-add-btn-wrapper" style="text-align:right; margin-top:20px;"><button id="gph-add-new-general-btn" class="gph-action-btn">新增指令</button></div>`);
                            closeConfirmModal();
                            renderUI();
                        }
                    });
                }
            }
        });
    };

    /* --- 自动继续功能核心逻辑 --- */
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const scrollToBottom = () => {
        if (!activePlatform || !activePlatform.scrollContainerSelector) {
            console.warn('GPH Warn: 当前平台未配置滚动容器选择器。');
            return;
        }
        const container = document.querySelector(activePlatform.scrollContainerSelector);
        if (container) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        } else {
            console.warn(`GPH Warn: 未找到滚动容器: "${activePlatform.scrollContainerSelector}"`);
        }
    };

    const stopAutoContinue = () => {
        isAutoContinuing = false;
        continueCount = 0;
        const continueBtn = document.getElementById('gph-auto-continue-btn');
        const counterSpan = document.getElementById('gph-continue-counter');
        if (continueBtn) continueBtn.firstChild.textContent = '自动继续';
        if (counterSpan) counterSpan.textContent = '';
        console.log('GPH: 自动继续任务已停止。');
    };

    async function startAutoContinue() {
        const continueBtn = document.getElementById('gph-auto-continue-btn');
        const counterSpan = document.getElementById('gph-continue-counter');

        while (continueCount > 0 && isAutoContinuing) {
            continueBtn.firstChild.textContent = '停止';
            counterSpan.textContent = `(${continueCount})`;

            console.log('GPH: 等待AI开始生成...');
            let stoppableButton = document.querySelector(activePlatform.stoppableSelector);
            while (!stoppableButton && isAutoContinuing) {
                await sleep(500);
                stoppableButton = document.querySelector(activePlatform.stoppableSelector);
            }
            if (!isAutoContinuing) break;

            console.log('GPH: AI正在生成，等待结束...');
            while (document.querySelector(activePlatform.stoppableSelector) && isAutoContinuing) {
                await sleep(500);
            }
            if (!isAutoContinuing) break;

            console.log('GPH: AI生成结束。');
            await sleep(1000);

            console.log('GPH: 准备发送 "继续"...');
            await sleep(200);

            const textarea = getActiveTextarea();
            if (!textarea) {
                showModal({ title: '错误', contentHTML: '<p>在自动继续期间找不到输入框，任务已中止。</p>', showCancel: false, confirmText: '关闭', onConfirm: (modal, closeModal) => closeModal()  });
                stopAutoContinue();
                return;
            }
            setInputValue(textarea, '继续');

            let attempts = 0;
            const maxAttempts = 20;
            let sendButton;

            while (isAutoContinuing) {
                sendButton = document.querySelector(activePlatform.sendButtonSelector);

                if (sendButton && !sendButton.disabled && sendButton.getAttribute('aria-disabled') !== 'true') {
                    console.log('GPH: 按钮已启用，准备发送...');
                    break;
                }

                if (attempts >= maxAttempts) {
                    console.error('GPH Error: 发送按钮长时间未启用或未找到，自动继续任务中止。');
                    showModal({ title: '错误', contentHTML: '<p>发送按钮长时间未启用或未找到，自动继续任务已中止。请检查页面状态。</p>', showCancel: false, confirmText: '关闭', onConfirm: (modal, closeModal) => closeModal()  });
                    stopAutoContinue();
                    return;
                }

                console.log(`GPH: 等待发送按钮启用... (尝试 ${attempts + 1}/${maxAttempts})`);
                await sleep(500);
                attempts++;
            }

            if (!isAutoContinuing) break;

            if (sendButton) {
                console.log('GPH: 发送 "继续"...');
                sendButton.click();
                scrollToBottom();
                continueCount--;
            } else {
                console.error('GPH Error: 最终未能获取到有效的发送按钮。');
                stopAutoContinue();
            }
        }

        stopAutoContinue();
    }

    /* --- 事件监听器 --- */
    panel.addEventListener('click', (e) => {
        const target = e.target.closest('button, .gph-role-tab');
        if (!target) return;

        if (target.id === 'gph-new-framework-btn') handleGenerateFramework();
        else if (target.id === 'gph-paste-json-btn') handlePasteAndCreateFramework();
        else if (target.id === 'gph-combine-send-btn') handleCombineAndSend();
        else if (target.id === 'gph-manage-framework-btn') handleManageFrameworks();
        else if (target.id === 'gph-manage-general-btn') handleManageGeneralPrompts(); /* --- 新增：通用管理事件 --- */
        else if (target.id === 'gph-auto-continue-btn') {
            if (isAutoContinuing) {
                stopAutoContinue();
            } else {
                const timesInput = document.getElementById('gph-continue-times-input');
                const num = parseInt(timesInput.value, 10);

                if (num && num > 0) {
                    continueCount = num;
                    isAutoContinuing = true;
                    showModal({
                        title: '任务准备就绪',
                        contentHTML: `<p>请手动发送您的初始请求。脚本将在AI开始生成后接管，并自动继续 ${num} 次。</p><p>您可以随时点击【停止】按钮来中止任务。</p>`,
                        showCancel: false,
                        confirmText: '我明白了',
                        onConfirm: (modal, closeModal) => closeModal()
                    });
                    startAutoContinue();
                }
            }
        }
        else if (target.matches('.gph-role-tab')) {
            if (target.id === 'gph-general-tab') {
                isGeneralModeActive = true;
            } else {
                isGeneralModeActive = false;
                activeRoleIndex = parseInt(target.dataset.index);
            }
            renderUI();
        }
        else if (target.matches('.gph-general-prompt-btn')) { /* --- 新增：通用指令按钮点击事件 (已添加调试日志) --- */
            console.log('%c--- GPH DEBUG: General Prompt Click ---', 'color: #3966B2; font-weight: bold;');
            const index = parseInt(target.dataset.index, 10);
            console.log(`[1] Click detected on button with index: ${index}`);

            const prompt = generalPrompts[index];
            if (prompt) {
                console.log('[2] Successfully retrieved prompt object:', prompt);

                const textarea = getActiveTextarea();
                console.log('[3] Searching for active textarea element...', textarea);

                if (textarea) {
                    console.info('[4] SUCCESS: Textarea element found. Proceeding to set value.');
                    console.log(`   - Text to append: "${prompt.prompt}"`);
                    setInputValue(textarea, prompt.prompt, true);
                    console.log('[5] setInputValue function has been executed. Check the input box now.');
                } else {
                    console.error('[4] FAILURE: Active textarea element was NOT found.');
                    console.error('   - This is the most likely cause of the issue.');
                    console.error(`   - The selector used for this platform was: "${activePlatform.selector}"`);
                }
            } else {
                console.error(`[2] FAILURE: Could not find a prompt object for index ${index}. The 'generalPrompts' array might be out of sync with the UI.`);
            }
            console.log('%c------------------------------------', 'color: #3966B2; font-weight: bold;');
        }
    });

    frameworkSelector.addEventListener('change', (e) => {
        activeFrameworkIndex = parseInt(e.target.value);
        activeRoleIndex = 0;
        renderUI();
    });

    /* --- 面板拖拽逻辑 --- */
    const header = panel.querySelector('#gph-header');
    let isDraggingPanel = false, offsetX, offsetY;
    header.addEventListener('mousedown', (e) => { isDraggingPanel = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; e.preventDefault(); });
    document.addEventListener('mousemove', (e) => { if (isDraggingPanel) { panel.style.left = `${e.clientX - offsetX}px`; panel.style.top = `${e.clientY - offsetY}px`; } });
    document.addEventListener('mouseup', () => { if(isDraggingPanel) { isDraggingPanel = false; savePanelState(); } });
    if (window.ResizeObserver) new ResizeObserver(savePanelState).observe(panel);

    /* --- 初始渲染 --- */
    renderUI();
})()