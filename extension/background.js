/**
 * Background Service Worker
 * 处理插件图标点击、首次安装事件
 */


/* --- 首次安装事件 --- */
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[GPH BG] 插件首次安装');
    } else if (details.reason === 'update') {
        console.log(`[GPH BG] 插件更新至 v${chrome.runtime.getManifest().version}`);
    }
});
