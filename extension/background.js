/**
 * Background Service Worker
 * 处理插件图标点击、首次安装事件
 */

/* --- 点击插件图标 → 切换面板 --- */
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;

    try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle-panel' });
    } catch (e) {
        /* --- 如果 content script 尚未响应，首次注入 CSS 后发送消息 --- */
        console.log('[GPH BG] Content script 未响应，尝试注入 CSS...');
        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['content.css']
            });
            /* --- JS 模块已由 manifest content_scripts 注入，直接重发消息 --- */
            await chrome.tabs.sendMessage(tab.id, { action: 'toggle-panel' });
        } catch (injErr) {
            console.error('[GPH BG] 操作失败:', injErr);
        }
    }
});

/* --- 首次安装事件 --- */
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[GPH BG] 插件首次安装');
    } else if (details.reason === 'update') {
        console.log(`[GPH BG] 插件更新至 v${chrome.runtime.getManifest().version}`);
    }
});
