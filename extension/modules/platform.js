/**
 * PlatformAdapter - 平台适配器模块
 * 精简版：提供侧边栏增强功能定位元素使用
 */
class PlatformAdapter {
    constructor() {
        this.PLATFORMS = [
            {
                name: 'Gemini',
                hostname: 'gemini.google.com',
                sidebarItemSelector: 'a[data-test-id="conversation"]',
                userMessageSelector: '.query-content, .user-query'
            }
        ];
        this._activePlatform = null;
    }

    /**
     * 检测当前页面所属的 AI 平台
     * @returns {Object|null} 当前平台配置或 null
     */
    detect() {
        const currentUrl = window.location.hostname + window.location.pathname;
        for (const platform of this.PLATFORMS) {
            if (currentUrl.includes(platform.hostname)) {
                this._activePlatform = platform;
                return platform;
            }
        }
        return null;
    }

    /** 获取当前活跃平台 */
    getActive() {
        return this._activePlatform;
    }
}