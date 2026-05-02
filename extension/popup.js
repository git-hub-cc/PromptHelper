/**
 * Popup Script - 弹出页面逻辑
 * 检测并显示当前页面状态
 */
document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('popup-status');
    const statusText = document.getElementById('status-text');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = new URL(tab.url || '');
        
        if (url.hostname.includes('gemini.google.com')) {
            statusEl.className = 'popup-status active';
            statusText.textContent = '插件已在当前页面生效';
        } else {
            statusEl.className = 'popup-status inactive';
            statusText.textContent = '请在 Gemini 页面使用本插件';
        }
    } catch (e) {
        statusEl.className = 'popup-status inactive';
        statusText.textContent = '无法检测当前页面状态';
        console.error('[GPH Popup] 状态检测失败:', e);
    }
});