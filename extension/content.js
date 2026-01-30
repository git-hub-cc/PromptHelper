/**
 * Content Script - 内容脚本主入口
 * 初始化各模块，接收 background.js 消息，管理面板生命周期
 */
(async function main() {
    'use strict';

    /* --- 防止重复注入 --- */
    if (document.getElementById('gph-ext-panel')) {
        console.log('[GPH] 面板已存在，跳过初始化');
        return;
    }

    /* --- 检测当前平台 --- */
    const platform = PlatformAdapter.detect();
    if (!platform) {
        console.log('[GPH] 未检测到支持的 AI 平台');
        return;
    }
    console.log(`[GPH] 已检测到平台: ${platform.name}`);

    /* --- 初始化存储（首次安装导入默认数据） --- */
    const defaultPromptsUrl = chrome.runtime.getURL('prompts/general_prompts.json');
    await StorageManager.initDefaults(defaultPromptsUrl);

    /* --- 加载元提示词模板 --- */
    await PromptEngine.loadMetaTemplate();

    /* --- 创建面板 --- */
    PanelUI.createPanel(platform.name);

    /* --- 加载数据并渲染 --- */
    await PanelUI.loadData();
    PanelUI.render();

    /* --- 监听 storage 变化以同步 UI --- */
    StorageManager.onChange(async (changes, area) => {
        if (area === 'sync') {
            const keysOfInterest = [StorageManager.KEYS.FRAMEWORKS, StorageManager.KEYS.GENERAL_PROMPTS];
            const hasRelevantChange = Object.keys(changes).some(k => keysOfInterest.includes(k));
            if (hasRelevantChange) {
                await PanelUI.loadData();
                PanelUI.render();
                console.log('[GPH] 存储变化已同步到 UI');
            }
        }
    });

    /* --- 监听来自 background.js 的消息 --- */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'toggle-panel') {
            PanelUI.toggle();
            sendResponse({ visible: PanelUI.isVisible() });
        }
        return true;
    });

    console.log('[GPH] PromptHelper 插件初始化完成');
})();
