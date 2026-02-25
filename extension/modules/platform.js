/**
 * PlatformAdapter - AI 平台适配器模块
 * 统一处理不同 AI 平台的 DOM 差异，提供跨平台输入/发送功能
 */
var PlatformAdapter = (() => {
    /* --- AI 平台配置表 --- */
    const PLATFORMS = [
        {
            name: 'AIStudio',
            hostname: 'aistudio.google.com',
            selector: 'ms-prompt-box textarea',
            sendButtonSelector: 'ms-run-button button[aria-label="Run"]',
            stoppableSelector: 'ms-run-button button:has(span.spin)',
            scrollContainerSelector: '.chat-view-container'
        },
        {
            name: 'Gemini',
            hostname: 'gemini.google.com',
            selector: 'rich-textarea .ql-editor[contenteditable="true"]',
            sendButtonSelector: 'button.send-button.submit',
            stoppableSelector: 'button.send-button.stop',
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
            hostname: 'chat.deepseek.com',
            selector: 'textarea#chat-input',
            sendButtonSelector: 'button[class*="send-btn"]',
            stoppableSelector: 'button[class*="stop-btn"]',
            scrollContainerSelector: 'div.custom-scroll-container'
        }
    ];

    let _activePlatform = null;

    /* --- Trusted Types 策略（某些平台需要） --- */
    let _policy = null;
    try {
        if (window.trustedTypes && window.trustedTypes.createPolicy) {
            _policy = window.trustedTypes.createPolicy('gph-ext-policy#default', {
                createHTML: str => str
            });
        }
    } catch (e) { /* 忽略 */ }

    /* --- 安全设置 innerHTML --- */
    const setSafeHTML = (element, html) => {
        if (_policy) {
            element.innerHTML = _policy.createHTML(html);
        } else {
            while (element.firstChild) element.removeChild(element.firstChild);
            const template = document.createElement('template');
            template.innerHTML = html;
            element.appendChild(template.content);
        }
    };

    /* --- 安全追加 HTML --- */
    const appendSafeHTML = (element, html) => {
        const template = document.createElement('template');
        if (_policy) {
            template.innerHTML = _policy.createHTML(html);
        } else {
            template.innerHTML = html;
        }
        element.appendChild(template.content);
    };

    /* --- HTML 转义 --- */
    const escapeHTML = (str) => {
        if (!str) return '';
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    };

    /**
     * 检测当前页面所属的 AI 平台
     * @returns {Object|null} 当前平台配置或 null
     */
    const detect = () => {
        const currentUrl = window.location.hostname + window.location.pathname;
        for (const platform of PLATFORMS) {
            if (currentUrl.includes(platform.hostname)) {
                if (document.querySelector(platform.selector)) {
                    _activePlatform = platform;
                    return platform;
                }
            }
        }
        return null;
    };

    /** 获取当前活跃平台 */
    const getActive = () => _activePlatform;

    /** 动态获取当前激活的输入框 */
    const getTextarea = () => {
        if (!_activePlatform) return null;
        return document.querySelector(_activePlatform.selector);
    };

    /** 获取输入框内容 */
    const getInputValue = (element) => {
        if (!element) return '';
        return element.isContentEditable ? element.innerText : element.value;
    };

    /** 设置输入框内容 */
    const setInputValue = (element, value, append = false) => {
        const currentContent = append ? getInputValue(element) : '';
        const newContent = append ? `${currentContent}\n${value}`.trim() : value;

        if (element.isContentEditable) {
            const lines = newContent.split('\n').map(
                line => `<p>${escapeHTML(line) || '<br>'}</p>`
            ).join('');
            setSafeHTML(element, lines);
        } else {
            element.value = newContent;
        }
        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    };

    /** 点击发送按钮 */
    const clickSend = () => {
        if (!_activePlatform) return;
        const btn = document.querySelector(_activePlatform.sendButtonSelector);
        if (btn) btn.click();
    };

    /** 判断 AI 是否正在生成 */
    const isGenerating = () => {
        if (!_activePlatform) return false;
        return !!document.querySelector(_activePlatform.stoppableSelector);
    };

    /** 判断发送按钮是否可用 */
    const isSendReady = () => {
        if (!_activePlatform) return false;
        const btn = document.querySelector(_activePlatform.sendButtonSelector);
        return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
    };

    /** 滚动到底部 */
    const scrollToBottom = () => {
        if (!_activePlatform?.scrollContainerSelector) return;
        const container = document.querySelector(_activePlatform.scrollContainerSelector);
        if (container) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
    };

    return {
        PLATFORMS,
        detect,
        getActive,
        getTextarea,
        getInputValue,
        setInputValue,
        clickSend,
        isGenerating,
        isSendReady,
        scrollToBottom,
        setSafeHTML,
        appendSafeHTML,
        escapeHTML
    };
})();
