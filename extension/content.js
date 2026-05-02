/**
 * Content Script - 内容脚本主入口
 * 仅保留 Gemini 侧边栏优化和代码块折叠的初始化逻辑
 */
(async function main() {
    'use strict';

    if (window.location.hostname.includes('gemini.google.com')) {
        // 等待平台检测并完成初始化，使用 ES6 Class 实例化
        const platformAdapter = new PlatformAdapter();
        const platform = platformAdapter.detect();

        if (platform) {
            const codeBlockFolder = new CodeBlockFolder();
            codeBlockFolder.init();

            const sidebarOptimizer = new SidebarOptimizer(platformAdapter);
            sidebarOptimizer.init();
        }
    }

    console.log('[GPH] 极简增强辅助插件初始化完成');
})();