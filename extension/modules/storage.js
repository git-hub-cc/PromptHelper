/**
 * StorageManager - 统一存储管理模块
 * 封装 chrome.storage.sync/local，提供框架和提示词的 CRUD 操作
 */
const StorageManager = (() => {
    /* --- 存储键名 --- */
    const KEYS = {
        FRAMEWORKS: 'gph_frameworks_v3',
        GENERAL_PROMPTS: 'gph_generalPrompts_v2',
        PANEL_STATE: 'gph_panelState_v2',
        INITIALIZED: 'gph_initialized_v1'
    };

    /* --- 通用读写 --- */
    const _get = (area, key, fallback) => {
        return new Promise(resolve => {
            chrome.storage[area].get(key, result => {
                resolve(result[key] ?? fallback);
            });
        });
    };

    const _set = (area, key, value) => {
        return new Promise(resolve => {
            chrome.storage[area].set({ [key]: value }, resolve);
        });
    };

    /* --- 框架管理 --- */
    const loadFrameworks = () => _get('sync', KEYS.FRAMEWORKS, []);

    const saveFrameworks = (data) => _set('sync', KEYS.FRAMEWORKS, data);

    /* --- 通用提示词管理 --- */
    const loadGeneralPrompts = () => _get('sync', KEYS.GENERAL_PROMPTS, []);

    const saveGeneralPrompts = (data) => _set('sync', KEYS.GENERAL_PROMPTS, data);

    /* --- 面板状态（本地存储，不同步） --- */
    const loadPanelState = () => _get('local', KEYS.PANEL_STATE, null);

    const savePanelState = (state) => _set('local', KEYS.PANEL_STATE, state);

    /* --- 首次安装初始化检测 --- */
    const isInitialized = () => _get('local', KEYS.INITIALIZED, false);

    const markInitialized = () => _set('local', KEYS.INITIALIZED, true);

    /**
     * 首次安装时导入默认提示词数据
     * @param {string} promptsUrl - general_prompts.json 的 URL
     */
    const initDefaults = async (promptsUrl) => {
        const initialized = await isInitialized();
        if (initialized) return;

        try {
            const response = await fetch(promptsUrl);
            if (response.ok) {
                const defaultPrompts = await response.json();
                const existing = await loadGeneralPrompts();
                if (existing.length === 0) {
                    await saveGeneralPrompts(defaultPrompts);
                    console.log('[GPH] 已导入默认通用提示词', defaultPrompts.length, '条');
                }
            }
        } catch (e) {
            console.warn('[GPH] 导入默认提示词失败:', e);
        }

        await markInitialized();
    };

    /**
     * 监听存储变化并触发回调
     * @param {Function} callback - (changes, areaName) => void
     */
    const onChange = (callback) => {
        chrome.storage.onChanged.addListener(callback);
    };

    return {
        KEYS,
        loadFrameworks,
        saveFrameworks,
        loadGeneralPrompts,
        saveGeneralPrompts,
        loadPanelState,
        savePanelState,
        initDefaults,
        onChange
    };
})();
