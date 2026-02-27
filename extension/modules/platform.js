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
        if (element.isContentEditable) {
            let text = '';
            for (const child of element.childNodes) {
                if (child.nodeName === 'P' || child.nodeName === 'DIV') {
                    // Check if paragraph is just an empty line <p><br></p>
                    if (child.childNodes.length === 1 && child.firstChild.nodeName === 'BR') {
                        text += '\n';
                    } else {
                        text += child.innerText + '\n';
                    }
                } else if (child.nodeName === 'BR') {
                    // In some edge cases top level BRs
                    text += '\n';
                } else if (child.nodeType === Node.TEXT_NODE) {
                    text += child.textContent;
                } else {
                    text += child.innerText || child.textContent;
                }
            }
            // Remove ONLY the final implicitly added newline
            if (text.endsWith('\n')) {
                text = text.slice(0, -1);
            }
            return text;
        }
        return element.value;
    };

    /** 设置输入框内容 */
    const setInputValue = (element, value, append = false) => {
        const currentContent = append ? getInputValue(element) : '';
        const newContent = append ? (currentContent ? `${currentContent}\n${value}` : value) : value;

        if (element.isContentEditable) {
            const lines = newContent.split('\n');
            const htmlParts = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Empty lines become <p><br></p>
                if (line.trim() === '') {
                    htmlParts.push('<p><br></p>');
                } else {
                    htmlParts.push(`<p>${escapeHTML(line)}</p>`);
                }
            }
            setSafeHTML(element, htmlParts.join(''));
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
