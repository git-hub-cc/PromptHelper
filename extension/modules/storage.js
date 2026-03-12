/**
 * StorageManager - 统一存储管理模块
 * 封装 chrome.storage.sync/local，提供框架和提示词的 CRUD 操作
 */
var StorageManager = (() => {
    /* --- 存储键名 --- */
    const KEYS = {
        FRAMEWORKS: 'gph_frameworks_v3',
        GENERAL_PROMPTS: 'gph_generalPrompts_v2',
        CATALOG_PROMPTS: 'gph_catalogPrompts_v1',
        PANEL_STATE: 'gph_panelState_v2',
        INITIALIZED: 'gph_initialized_v2' // Bump version for migration
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

    /* --- 提示词目录管理 (原来的通用指令合并进来) --- */
    const loadCatalogPrompts = () => _get('sync', KEYS.CATALOG_PROMPTS, []);

    const saveCatalogPrompts = (data) => _set('sync', KEYS.CATALOG_PROMPTS, data);

    /* --- 面板状态（本地存储，不同步） --- */
    const loadPanelState = () => _get('local', KEYS.PANEL_STATE, null);

    const savePanelState = (state) => _set('local', KEYS.PANEL_STATE, state);

    /* --- 首次安装初始化检测 --- */
    const isInitialized = () => _get('local', KEYS.INITIALIZED, false);

    const markInitialized = () => _set('local', KEYS.INITIALIZED, true);

    /**
     * 首次安装时导入默认提示词数据，并处理从通用指令的迁移
     */
    const initDefaults = async (catalogUrl) => {
        const initialized = await isInitialized();
        if (initialized) return;

        try {
            // 迁移逻辑：如果旧的通用指令有数据，先迁移到目录
            const oldGeneralPrompts = await _get('sync', 'gph_generalPrompts_v2', []);
            let currentCatalog = await loadCatalogPrompts();

            if (oldGeneralPrompts.length > 0) {
                // 将旧通用指令合并到目录中（去重逻辑可以简单处理，或者直接追加）
                const newItems = oldGeneralPrompts.filter(gp => 
                    !currentCatalog.some(cp => cp.name === gp.name && cp.prompt === gp.prompt)
                );
                if (newItems.length > 0) {
                    currentCatalog = [...currentCatalog, ...newItems];
                    await saveCatalogPrompts(currentCatalog);
                    console.log('[GPH] 已从通用指令迁移', newItems.length, '条提示词');
                }
            }

            // 如果目录仍然为空，则加载内置默认值
            if (currentCatalog.length === 0) {
                const response = await fetch(catalogUrl);
                if (response.ok) {
                    const defaultPrompts = await response.json();
                    await saveCatalogPrompts(defaultPrompts);
                    console.log('[GPH] 已导入默认提示词目录', defaultPrompts.length, '条');
                }
            }
        } catch (e) {
            console.warn('[GPH] 初始化/迁移提示词失败:', e);
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
        loadCatalogPrompts,
        saveCatalogPrompts,
        loadPanelState,
        savePanelState,
        initDefaults,
        onChange
    };
})();
