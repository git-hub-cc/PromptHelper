// ==UserScript==
// @name         AI 多角色框架助手 (Gemini MVP Helper)
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  全能AI助手：支持 ChatGPT、Gemini、DeepSeek、AIStudio。提供多角色框架管理、结构化提示词生成、自动继续生成、批量导入通用指令等功能。支持跨平台数据同步。
// @author       YourName
// @match        https://aistudio.google.com/*
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @match        https://chat.deepseek.com/*
// @match        https://www.deepseek.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    /* --- 核心入口函数：用于切换面板显示状态 --- */
    function togglePanel() {
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

        /* --- 初始化脚本逻辑 --- */
        initScript(panelId, styleId);
    }

    /* --- 注册油猴菜单命令 --- */
    GM_registerMenuCommand("开关 AI 助手面板", togglePanel);

    /* --- 主逻辑封装 --- */
    function initScript(panelId, styleId) {
        /* --- 本地存储KEY (使用 GM_ API 实现跨域共享) --- */
        const STORAGE_KEY_FRAMEWORKS = 'gph_roleFrameworks_v2';
        const STORAGE_KEY_PANEL_STATE = 'gph_panelState_v1';
        const STORAGE_KEY_GENERAL_PROMPTS = 'gph_generalPrompts_v1';

        /* --- AI平台配置 --- */
        const AI_PLATFORMS = [
        {
        name: 'AIStudio',
        hostname: 'aistudio.google.com',
        selector: 'ms-prompt-box textarea',
        // 🔴 修改了下面这一行 (将原来的 button[aria-label="Run"] 改为 button.ms-button-primary)
        sendButtonSelector: 'ms-run-button button.ms-button-primary',
        stoppableSelector: 'ms-run-button button:has(span.spin)',
        scrollContainerSelector: '.chat-view-container'
        },
        {
        name: 'Gemini',
        hostname: 'gemini.google.com',
        // 输入框选择器保持不变，匹配 rich-textarea 下的编辑器
        selector: 'rich-textarea .ql-editor[contenteditable="true"]',
        // 发送按钮：根据提供的 HTML，精确匹配 button 标签和 aria-label
        sendButtonSelector: 'button[aria-label="Send message"]',
        // 停止按钮：关键修改。Gemini 现在可能显示 "Stop response" 而不是 "Stop generating"
        // 使用 *= 模糊匹配 "Stop"，只要 aria-label 包含 Stop 就会被识别为正在生成
        stoppableSelector: 'button[aria-label*="Stop"]',
        scrollContainerSelector: 'ms-autoscroll-container'
        },
        {
        name: 'ChatGPT',
        hostname: 'chatgpt.com',
        selector: '#prompt-textarea',
        sendButtonSelector: 'button[data-testid="send-button"]',
        stoppableSelector: 'button[aria-label*="Stop"]',
        scrollContainerSelector: 'main .overflow-y-auto'
        },
        {
        name: 'DeepSeek',
        hostname: ['chat.deepseek.com', 'www.deepseek.com'],
        selector: 'textarea#chat-input',
        sendButtonSelector: 'div[class*="ds-button"]',
        stoppableSelector: 'div[class*="ds-stop"]',
        scrollContainerSelector: 'div.custom-scroll-container'
        },
        ];

        /* --- 元提示词模板 ---  */
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
        const currentHostname = window.location.hostname;
        let isAutoContinuing = false;
        let continueCount = 0;
        let isGeneralModeActive = false;

        /* --- 动态查找平台 --- */
        for (const platform of AI_PLATFORMS) {
            let isMatch = false;
            if (Array.isArray(platform.hostname)) {
                isMatch = platform.hostname.some(h => currentHostname.includes(h));
            } else {
                isMatch = currentHostname.includes(platform.hostname);
            }

            if (isMatch) {
                activePlatform = platform;
                break;
            }
        }

        /* --- 获取当前活动输入框 --- */
        const getActiveTextarea = () => {
            if (!activePlatform) return null;
            return document.querySelector(activePlatform.selector);
        };

        if (!activePlatform) {
            alert('当前页面不是支持的 AI 平台，或脚本未适配。\n支持平台: Gemini, ChatGPT, DeepSeek, AIStudio。');
            return;
        }

        /* --- 数据持久化函数 (UserScript 适配版) --- */
        const saveFrameworks = (data) => {
            try { GM_setValue(STORAGE_KEY_FRAMEWORKS, JSON.stringify(data)); } catch (e) { console.error("GPH Error: Failed to save frameworks.", e); }
        };
        const loadFrameworks = () => {
            try { const storedData = GM_getValue(STORAGE_KEY_FRAMEWORKS); return storedData ? JSON.parse(storedData) : []; } catch (e) { console.error("GPH Error: Failed to load frameworks.", e); return []; }
        };
        const saveGeneralPrompts = (data) => {
            try { GM_setValue(STORAGE_KEY_GENERAL_PROMPTS, JSON.stringify(data)); } catch (e) { console.error("GPH Error: Failed to save general prompts.", e); }
        };
        const loadGeneralPrompts = () => {
            try { const storedData = GM_getValue(STORAGE_KEY_GENERAL_PROMPTS); return storedData ? JSON.parse(storedData) : []; } catch (e) { console.error("GPH Error: Failed to load general prompts.", e); return []; }
        };

        /* --- 加载数据 --- */
        let frameworks = loadFrameworks();
        let generalPrompts = loadGeneralPrompts();

        /* --- 更多状态变量 --- */
        let activeFrameworkIndex = frameworks.length > 0 ? 0 : -1;
        let activeRoleIndex = 0;

        /* --- Trusted Types 适配 --- */
        let policy = null;
        try {
            if (window.trustedTypes && window.trustedTypes.createPolicy) {
                policy = window.trustedTypes.createPolicy('gph-policy#default', { createHTML: string => string });
            }
        } catch (e) { /* 忽略 */ }

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
            if (typeof str !== 'string') return '';
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
        #gph-title { margin: 0; font-size: 14px; font-weight: normal; color: var(--text-title); display:flex; align-items:center; gap:8px; }
        #gph-framework-manager { display: flex; gap: 10px; padding: 10px 15px; border-bottom: 1px solid var(--border-primary); align-items: center; flex-shrink: 0; flex-wrap: wrap; }
        #gph-framework-selector { flex-grow: 1; background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary); border-radius: 4px; padding: 8px; font-size: 13px; }
        .gph-action-btn { background: var(--accent-primary); color: var(--text-button); border: 1px solid var(--accent-primary); border-radius: 4px; padding: 8px 12px; cursor: pointer; font-size: 13px; white-space: nowrap; }
        .gph-action-btn:hover { filter: brightness(1.1); }
        .gph-secondary-btn { background: var(--accent-secondary); border-color: var(--accent-secondary); }
        #gph-body { padding: 15px; overflow-y: auto; flex-grow: 1; }
        #gph-role-tabs { display: flex; border-bottom: 1px solid var(--border-primary); margin-bottom: 15px; flex-wrap: wrap; padding: 0; }
        .gph-role-tab { list-style: none; padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; font-size: 13px; color: var(--text-secondary); }
        .gph-role-tab.active { border-bottom-color: var(--accent-primary); color: var(--text-primary); font-weight: bold; }
        #gph-general-tab { margin-left: auto; border-left: 1px solid var(--border-primary); }
        #gph-general-prompts-container { display: flex; flex-wrap: wrap; gap: 10px; }
        .gph-general-prompt-btn { flex-grow: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
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
                        .bg { fill: url(#logo-gradient-${panelId}); } .grad-stop-1 { stop-color: #007ACC; } .grad-stop-2 { stop-color: #009688; } .main-element { fill: white; fill-opacity: 0.9; }
                        @media (prefers-color-scheme: dark) { .bg { fill: #2D3748; } .grad-stop-1, .grad-stop-2 { stop-color: transparent; } .main-element { fill: #D1D5DB; fill-opacity: 1; } }
                    </style>
                    <defs>
                        <linearGradient id="logo-gradient-${panelId}" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
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
                AI 助手 (${escapeHTML(activePlatform.name)})
                </h3>
                <button id="gph-close-panel" style="background:none; border:none; color:inherit; cursor:pointer; font-size:18px;">&times;</button>
            </div>
            <div id="gph-framework-manager">
                <select id="gph-framework-selector"></select>
                <button id="gph-new-framework-btn" class="gph-action-btn" title="生成元提示词">+</button>
                <button id="gph-paste-json-btn" class="gph-action-btn gph-secondary-btn" title="粘贴AI返回的JSON创建框架">粘贴JSON</button>
                <button id="gph-manage-framework-btn" class="gph-action-btn gph-secondary-btn">管理框架</button>
                <button id="gph-manage-general-btn" class="gph-action-btn gph-secondary-btn">管理通用</button>
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
        const savePanelState = () => { try { GM_setValue(STORAGE_KEY_PANEL_STATE, JSON.stringify({ left: panel.style.left, top: panel.style.top, width: panel.style.width, height: panel.style.height })); } catch (e) { /* 忽略 */ } };
        const loadPanelState = () => { try { const state = JSON.parse(GM_getValue(STORAGE_KEY_PANEL_STATE)); if (state) { Object.assign(panel.style, state); } } catch (e) { /* 忽略 */ } };
        loadPanelState();

        /* --- 获取DOM元素引用 --- */
        const bodyEl = panel.querySelector('#gph-body');
        const frameworkSelector = panel.querySelector('#gph-framework-selector');

        /* --- 跨平台输入框操作函数 --- */
        const setInputValue = (element, value, append = false) => {
            if (!element) return;
            // 确保输入框获得焦点
            element.focus();
            const currentContent = append ? getInputValue(element) : '';
            const newContent = append ? `${currentContent}\n${value}`.trim() : value;

            if (element.isContentEditable) {
                // 对于 contentEditable (如 Gemini)，需要小心处理 HTML
                // 简单的换行转换为段落，以保持兼容性
                const lines = newContent.split('\n');
                let htmlContent = '';
                lines.forEach(line => {
                    htmlContent += `<p>${escapeHTML(line) || '<br>'}</p>`;
                });
                setSafeHTML(element, htmlContent);
            } else {
                // 标准 textarea (如 ChatGPT, DeepSeek)
                // 原生 setter hack，确保 React/Vue 框架能检测到变化
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(element, newContent);
                } else {
                    element.value = newContent;
                }
            }
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        };

        const getInputValue = (element) => {
            if (!element) return '';
            if (element.isContentEditable) {
                return element.innerText;
            }
            return element.value;
        };

        /* --- UI 渲染函数 --- */
        const renderUI = () => {
            const frameworkControls = ['#gph-new-framework-btn', '#gph-paste-json-btn', '#gph-manage-framework-btn', '#gph-combine-send-btn'];
            const generalControls = ['#gph-manage-general-btn'];
            frameworkControls.forEach(sel => panel.querySelector(sel).style.display = isGeneralModeActive ? 'none' : 'inline-block');
            generalControls.forEach(sel => panel.querySelector(sel).style.display = isGeneralModeActive ? 'inline-block' : 'none');

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

        /* --- 核心逻辑函数 --- */
        const handleGenerateFramework = () => {
            showModal({
                title: '创建新框架',
                contentHTML: `
                    <label for="gph-domain-input">请输入领域/主题：</label>
                    <input type="text" id="gph-domain-input" placeholder="例如：软件开发项目重构" style="margin-bottom: 15px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px 15px;">
                        <div><label for="gph-role-count-input">角色数量:</label><input type="number" id="gph-role-count-input" value="3" min="2" max="5"></div>
                        <div><label for="gph-directives-count-input">指令数:</label><input type="number" id="gph-directives-count-input" value="3" min="1" max="5"></div>
                        <div><label for="gph-considerations-count-input">考量维度数:</label><input type="number" id="gph-considerations-count-input" value="3" min="1" max="5"></div>
                        <div><label for="gph-personalization-count-input">个性化数:</label><input type="number" id="gph-personalization-count-input" value="2" min="1" max="4"></div>
                    </div>`,
                onConfirm: (modal, closeModal) => {
                    const domain = modal.querySelector('#gph-domain-input').value.trim();
                    if (!domain) return;
                    const roleCount = modal.querySelector('#gph-role-count-input').value;
                    const directivesCount = modal.querySelector('#gph-directives-count-input').value;
                    const considerationsCount = modal.querySelector('#gph-considerations-count-input').value;
                    const personalizationCount = modal.querySelector('#gph-personalization-count-input').value;

                    const finalPrompt = META_PROMPT_TEMPLATE
                        .replace('[ROLE_COUNT]', roleCount)
                        .replace('[DIRECTIVES_COUNT]', directivesCount)
                        .replace('[CONSIDERATIONS_COUNT]', considerationsCount)
                        .replace('[PERSONALIZATION_COUNT]', personalizationCount);

                    const textarea = getActiveTextarea();
                    if (!textarea) {
                        showModal({ title: '错误', contentHTML: '<p>无法找到AI输入框，请确保页面已加载完成。</p>', showCancel: false, confirmText: '关闭', onConfirm: (m, c) => c()  });
                        return;
                    }
                    setInputValue(textarea, finalPrompt + domain);
                    closeModal();

                    document.querySelector(activePlatform.sendButtonSelector)?.click();
                    setTimeout(() => {
                        document.querySelector(activePlatform.sendButtonSelector)?.click();
                        showModal({
                            title: '操作指南',
                            contentHTML: `<p>提示词已发送。</p><p>请等待AI生成完毕，**复制完整的JSON代码块**，然后点击面板上的【粘贴JSON】按钮。</p>`,
                            showCancel: false, confirmText: '我明白了', onConfirm: (m, c) => c()
                        });
                    }, 500);
                }
            });
        };

        const handlePasteAndCreateFramework = () => {
            const contentHTML = `<p>请将AI生成的包含JSON代码块的文本粘贴到下方。</p><textarea id="gph-json-paste-area" rows="10" placeholder="在此处粘贴..."></textarea>`;
            showModal({
                title: '从JSON创建新框架', contentHTML: contentHTML, confirmText: '创建',
                onConfirm: (modal, closeModal) => {
                    let rawText = modal.querySelector('#gph-json-paste-area').value.trim();
                    if (!rawText) return;
                    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
                    const jsonString = jsonMatch ? jsonMatch[1] : (rawText.startsWith('{') ? rawText : null);
                    closeModal();
                    if (!jsonString) {
                        showModal({ title: '提取失败', contentHTML: `<p>未找到有效的JSON代码块。</p>`, showCancel: false, confirmText: '关闭', onConfirm: (m, c) => c() });
                        return;
                    }
                    try {
                        const newFrameworkData = JSON.parse(jsonString);
                        if (!newFrameworkData.name || !Array.isArray(newFrameworkData.roles)) throw new Error('缺少 name 或 roles 字段。');
                        newFrameworkData.id = `framework_${Date.now()}`;
                        frameworks.push(newFrameworkData);
                        activeFrameworkIndex = frameworks.length - 1;
                        activeRoleIndex = 0;
                        saveFrameworks(frameworks);
                        renderUI();
                        showModal({ title: '成功', contentHTML: `<p>已添加 <strong>${escapeHTML(newFrameworkData.name)}</strong>！</p>`, showCancel: false, confirmText: '好的', onConfirm: (m, c) => c() });
                    } catch (error) {
                        showModal({ title: '解析失败', contentHTML: `<p>JSON格式错误: ${escapeHTML(error.message)}</p>`, showCancel: false, confirmText: '关闭', onConfirm: (m, c) => c() });
                    }
                }
            });
        };

        const handleCombineAndSend = () => {
            if (activeFrameworkIndex < 0) return;
            const framework = frameworks[activeFrameworkIndex];
            const role = framework.roles[activeRoleIndex];
            const textarea = getActiveTextarea();
            if (!textarea) {
                showModal({ title: '错误', contentHTML: '<p>无法找到AI输入框。</p>', showCancel: false, confirmText: '关闭', onConfirm: (m, c) => c() });
                return;
            }

            const checkedDirectives = Array.from(bodyEl.querySelectorAll('#gph-directives-list input:checked')).map(cb => role.directives[cb.dataset.index]);
            const checkedConsiderations = Array.from(bodyEl.querySelectorAll('#gph-considerations-list input:checked')).map(cb => role.considerations[cb.dataset.index].text);
            const personalizationDirectives = Array.from(bodyEl.querySelectorAll('#gph-personalization-section input[type="radio"]:checked'))
                .map(radio => {
                    const profileIndex = parseInt(radio.dataset.profileIndex, 10);
                    const optionIndex = parseInt(radio.dataset.optionIndex, 10);
                    return role.personalizationProfiles[profileIndex]?.options[optionIndex]?.directive;
                }).filter(Boolean);

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

        /* --- 自动继续逻辑 --- */
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const stopAutoContinue = () => {
            isAutoContinuing = false;
            continueCount = 0;
            const continueBtn = document.getElementById('gph-auto-continue-btn');
            const counterSpan = document.getElementById('gph-continue-counter');
            if (continueBtn) continueBtn.firstChild.textContent = '自动继续';
            if (counterSpan) counterSpan.textContent = '';
        };

        async function startAutoContinue() {
            const continueBtn = document.getElementById('gph-auto-continue-btn');
            const counterSpan = document.getElementById('gph-continue-counter');

            while (continueCount > 0 && isAutoContinuing) {
                continueBtn.firstChild.textContent = '停止';
                counterSpan.textContent = `(${continueCount})`;
                // 等待开始
                let stoppableButton = document.querySelector(activePlatform.stoppableSelector);
                while (!stoppableButton && isAutoContinuing) { await sleep(500); stoppableButton = document.querySelector(activePlatform.stoppableSelector); }
                if (!isAutoContinuing) break;
                // 等待结束
                while (document.querySelector(activePlatform.stoppableSelector) && isAutoContinuing) { await sleep(500); }
                if (!isAutoContinuing) break;
                await sleep(1000);

                const textarea = getActiveTextarea();
                if (!textarea) { stopAutoContinue(); return; }
                setInputValue(textarea, '继续');

                // 等待发送按钮
                let attempts = 0;
                let sendButton;
                while (isAutoContinuing && attempts < 20) {
                    sendButton = document.querySelector(activePlatform.sendButtonSelector);
                    if (sendButton && !sendButton.disabled && sendButton.getAttribute('aria-disabled') !== 'true') break;
                    await sleep(500);
                    attempts++;
                }
                if (!isAutoContinuing || !sendButton) { stopAutoContinue(); break; }
                sendButton.click();
                continueCount--;
            }
            stopAutoContinue();
        }

        /* --- 优化后的通用提示词管理函数 --- */
        const handleManageGeneralPrompts = () => {
            // 1. 定义生成列表HTML的辅助函数
            const getManageListHTML = () => {
                if (!generalPrompts || generalPrompts.length === 0) return '<p style="padding:10px; color:var(--text-secondary);">没有可管理的通用指令。</p>';
                return `<ul class="gph-manage-list">${generalPrompts.map((p, i) => `
                <li class="gph-manage-item" data-index="${i}">
                    <div style="overflow:hidden;">
                        <span class="gph-manage-item-name" style="font-weight:bold;">${escapeHTML(p.name)}</span>
                        <div style="font-size:12px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(p.prompt)}</div>
                    </div>
                    <div class="gph-manage-item-buttons">
                        <button class="gph-action-btn gph-edit-general-btn">编辑</button>
                        <button class="gph-action-btn gph-secondary-btn gph-delete-general-btn">删除</button>
                    </div>
                </li>`).join('')}</ul>`;
            };

            // 2. 定义底部按钮栏HTML
            const getButtonsHTML = () => `
            <div class="gph-add-btn-wrapper" style="text-align:right; margin-top:20px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-primary); padding-top:10px;">
                <div>
                    <button id="gph-import-json-btn" class="gph-action-btn gph-secondary-btn" title="覆盖导入JSON配置">导入JSON</button>
                    <button id="gph-export-json-btn" class="gph-action-btn gph-secondary-btn" title="备份当前配置">导出JSON</button>
                </div>
                <button id="gph-add-new-general-btn" class="gph-action-btn">+ 新增指令</button>
            </div>`;

            // 3. 刷新模态框内容的辅助函数
            const refreshModalContent = (modalBody) => {
                setSafeHTML(modalBody, getManageListHTML() + getButtonsHTML());
            };

            // 4. 编辑/新增 单个指令的模态框
            const showEditPromptModal = (index = -1) => {
                const isEditing = index > -1;
                const prompt = isEditing ? generalPrompts[index] : { name: '', prompt: '' };
                showModal({
                    title: isEditing ? '编辑通用指令' : '新增通用指令',
                    contentHTML: `
                    <label for="gph-prompt-name">指令名称 (按钮显示):</label>
                    <input type="text" id="gph-prompt-name" value="${escapeHTML(prompt.name)}" placeholder="例如：01 代码分析">
                    <label for="gph-prompt-content">指令内容 (发送给AI):</label>
                    <textarea id="gph-prompt-content" rows="8" placeholder="在此输入具体的提示词...">${escapeHTML(prompt.prompt)}</textarea>`,
                    confirmText: '保存',
                    onConfirm: (modal, closeModal) => {
                        const name = modal.querySelector('#gph-prompt-name').value.trim();
                        const content = modal.querySelector('#gph-prompt-content').value.trim();
                        if (!name || !content) {
                            alert('名称和内容不能为空');
                            return;
                        }

                        const newObj = { name: name, prompt: content };
                        if (isEditing) {
                            generalPrompts[index] = newObj;
                        } else {
                            generalPrompts.push(newObj);
                        }
                        saveGeneralPrompts(generalPrompts);
                        renderUI();

                        const manageModal = document.querySelector('#gph-modal-container');
                        if(manageModal) {
                            closeModal();
                            handleManageGeneralPrompts();
                        } else {
                            closeModal();
                        }
                    }
                });
            };

            // 5. 显示管理模态框
            const modal = showModal({
                title: '管理通用指令',
                contentHTML: getManageListHTML() + getButtonsHTML(),
                showCancel: false,
                confirmText: '关闭',
                onConfirm: (modalInstance, closeModal) => closeModal()
            });

            const modalBody = modal.querySelector('#gph-modal-body');

            // 6. 事件委托处理所有点击事件
            modalBody.addEventListener('click', (e) => {
                const target = e.target;
                const item = target.closest('.gph-manage-item');

                // --- 处理：新增 ---
                if (target.closest('#gph-add-new-general-btn')) {
                    showEditPromptModal();
                }
                // --- 处理：编辑 ---
                else if (item && target.closest('.gph-edit-general-btn')) {
                    const index = parseInt(item.dataset.index, 10);
                    showEditPromptModal(index);
                }
                // --- 处理：删除 (修复版) ---
                else if (item && target.closest('.gph-delete-general-btn')) {
                    if (confirm('确定要删除这条指令吗？')) {
                        const index = parseInt(item.dataset.index, 10);
                        generalPrompts.splice(index, 1); // 从数组移除
                        saveGeneralPrompts(generalPrompts); // 保存
                        renderUI(); // 更新主面板
                        refreshModalContent(modalBody); // 立即更新列表显示
                    }
                }
                // --- 处理：导出 JSON ---
                else if (target.closest('#gph-export-json-btn')) {
                    const jsonStr = JSON.stringify(generalPrompts, null, 2);
                    showModal({
                        title: '导出配置',
                        contentHTML: `<p>请复制下方内容保存到本地文件 (如 01.json)：</p><textarea rows="15" readonly onclick="this.select()">${escapeHTML(jsonStr)}</textarea>`,
                        showCancel: false,
                        confirmText: '关闭',
                        onConfirm: (m, c) => c()
                    });
                }
                // --- 处理：导入 JSON (核心需求) ---
                else if (target.closest('#gph-import-json-btn')) {
                    showModal({
                        title: '导入配置 (覆盖)',
                        contentHTML: `
                        <p style="color:#ff6b6b; font-weight:bold;">警告：这将覆盖当前所有通用指令！</p>
                        <p>请粘贴 JSON 数组格式的内容：</p>
                        <textarea id="gph-import-area" rows="10" placeholder='[{"name":"...", "prompt":"..."}]'></textarea>
                    `,
                        confirmText: '确认导入并覆盖',
                        onConfirm: (importModal, closeImportModal) => {
                            const rawStr = importModal.querySelector('#gph-import-area').value.trim();
                            if(!rawStr) return;

                            try {
                                const data = JSON.parse(rawStr);
                                if (!Array.isArray(data)) throw new Error('输入必须是 JSON 数组格式');

                                const isValid = data.every(item => item.name && item.prompt);
                                if (!isValid) throw new Error('数组中的每一项必须包含 "name" 和 "prompt" 字段');

                                generalPrompts = data;
                                saveGeneralPrompts(generalPrompts);

                                renderUI();
                                refreshModalContent(modalBody);

                                closeImportModal();
                                alert(`成功导入 ${data.length} 条指令！`);
                            } catch (err) {
                                alert('导入失败，JSON 格式错误：\n' + err.message);
                            }
                        }
                    });
                }
            });
        };

        const handleManageFrameworks = () => {
            // 简化版，删除功能
            const getManageListHTML = () => {
                if (frameworks.length === 0) return '<p>没有可管理的框架。</p>';
                return `<ul class="gph-manage-list">${frameworks.map((f, i) => `
                    <li class="gph-manage-item" data-index="${i}">
                        <span class="gph-manage-item-name">${escapeHTML(f.name)}</span>
                        <div class="gph-manage-item-buttons"><button class="gph-action-btn gph-secondary-btn gph-delete-btn">删除</button></div>
                    </li>`).join('')}</ul>`;
            };
            const modal = showModal({
                title: '管理框架', contentHTML: getManageListHTML(), showCancel: false, confirmText: '关闭', onConfirm: (m, c) => c()
            });
            modal.querySelector('#gph-modal-body').addEventListener('click', (e) => {
                if (e.target.closest('.gph-delete-btn')) {
                    const idx = parseInt(e.target.closest('.gph-manage-item').dataset.index, 10);
                    frameworks.splice(idx, 1);
                    if (frameworks.length === 0) activeFrameworkIndex = -1;
                    else activeFrameworkIndex = Math.min(activeFrameworkIndex, frameworks.length - 1);
                    saveFrameworks(frameworks);
                    renderUI();
                    modal.querySelector('#gph-modal-body').innerHTML = getManageListHTML();
                }
            });
        };

        /* --- 事件监听 --- */
        panel.addEventListener('click', (e) => {
            const target = e.target.closest('button, .gph-role-tab');
            if (!target) return;

            if (target.id === 'gph-new-framework-btn') handleGenerateFramework();
            else if (target.id === 'gph-paste-json-btn') handlePasteAndCreateFramework();
            else if (target.id === 'gph-combine-send-btn') handleCombineAndSend();
            else if (target.id === 'gph-manage-framework-btn') handleManageFrameworks();
            else if (target.id === 'gph-manage-general-btn') handleManageGeneralPrompts();
            else if (target.id === 'gph-close-panel') togglePanel();
            else if (target.id === 'gph-auto-continue-btn') {
                if (isAutoContinuing) stopAutoContinue();
                else {
                    const num = parseInt(document.getElementById('gph-continue-times-input').value, 10);
                    if (num > 0) {
                        continueCount = num; isAutoContinuing = true;
                        showModal({ title: '准备就绪', contentHTML: `<p>请发送初始请求，脚本将在AI回复后自动接管。</p>`, showCancel: false, confirmText: '好的', onConfirm: (m, c) => c() });
                        startAutoContinue();
                    }
                }
            }
            else if (target.matches('.gph-role-tab')) {
                if (target.id === 'gph-general-tab') isGeneralModeActive = true;
                else { isGeneralModeActive = false; activeRoleIndex = parseInt(target.dataset.index); }
                renderUI();
            }
            else if (target.matches('.gph-general-prompt-btn')) {
                const prompt = generalPrompts[parseInt(target.dataset.index, 10)];
                const textarea = getActiveTextarea();
                if (textarea && prompt) setInputValue(textarea, prompt.prompt, true);
                else if (!textarea) showModal({ title: '错误', contentHTML: '<p>未找到输入框，请确保页面已加载完成。</p>', showCancel: false, confirmText: '关闭', onConfirm: (m, c) => c() });
            }
        });

        frameworkSelector.addEventListener('change', (e) => {
            activeFrameworkIndex = parseInt(e.target.value);
            activeRoleIndex = 0;
            renderUI();
        });

        /* --- 拖拽逻辑 --- */
        const header = panel.querySelector('#gph-header');
        let isDraggingPanel = false, offsetX, offsetY;
        header.addEventListener('mousedown', (e) => { isDraggingPanel = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; e.preventDefault(); });
        document.addEventListener('mousemove', (e) => { if (isDraggingPanel) { panel.style.left = `${e.clientX - offsetX}px`; panel.style.top = `${e.clientY - offsetY}px`; } });
        document.addEventListener('mouseup', () => { if(isDraggingPanel) { isDraggingPanel = false; savePanelState(); } });
        if (window.ResizeObserver) new ResizeObserver(savePanelState).observe(panel);

        renderUI();
    }
})();