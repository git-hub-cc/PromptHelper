/**
 * Popup Script - 弹出页面逻辑
 * 显示状态信息，提供快速操作
 */
document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('popup-status');
    const statusText = document.getElementById('status-text');
    const toggleBtn = document.getElementById('toggle-panel-btn');
    const statFrameworks = document.getElementById('stat-frameworks');
    const statPrompts = document.getElementById('stat-prompts');

    /* --- 加载统计数据 --- */
    try {
        const result = await chrome.storage.sync.get([
            'gph_frameworks_v3',
            'gph_generalPrompts_v2'
        ]);
        const frameworks = result.gph_frameworks_v3 || [];
        const prompts = result.gph_generalPrompts_v2 || [];
        statFrameworks.textContent = frameworks.length;
        statPrompts.textContent = prompts.length;
    } catch (e) {
        console.warn('[GPH Popup] 加载统计失败:', e);
    }

    /* --- 检测当前标签页是否是支持的 AI 平台 --- */
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const supportedHosts = ['aistudio.google.com', 'gemini.google.com', 'chatgpt.com', 'chat.deepseek.com'];
        const url = new URL(tab.url || '');
        const isSupported = supportedHosts.some(h => url.hostname.includes(h));

        if (isSupported) {
            statusEl.className = 'popup-status active';
            statusText.textContent = `已连接: ${url.hostname.split('.')[0]}`;
            toggleBtn.disabled = false;
        } else {
            statusEl.className = 'popup-status inactive';
            statusText.textContent = '当前页面不是支持的 AI 平台';
            toggleBtn.disabled = true;
        }
    } catch (e) {
        statusEl.className = 'popup-status inactive';
        statusText.textContent = '无法检测当前页面';
        toggleBtn.disabled = true;
    }

    /* --- 切换面板按钮 --- */
    toggleBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'toggle-panel' });
            } catch (e) {
                /* --- 首次点击时注入 content script --- */
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: [
                        'modules/storage.js',
                        'modules/platform.js',
                        'modules/modal.js',
                        'modules/prompt-engine.js',
                        'ui/tabs.js',
                        'ui/panel.js',
                        'content.js'
                    ]
                });
                await chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['content.css']
                });
            }
            window.close();
        } catch (err) {
            console.error('[GPH Popup] 操作失败:', err);
        }
    });
});
