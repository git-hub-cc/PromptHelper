/**
 * SidebarOptimizer - Gemini 侧边栏优化模块
 * 允许在侧边栏显示用户发送的消息（默认折叠），方便快速定位。
 */
var SidebarOptimizer = (() => {
    const STORAGE_KEY = 'gph_conv_history';
    let _capturing = false;

    /** 初始化 */
    const init = () => {
        if (!window.location.hostname.includes('gemini.google.com')) return;
        
        // 注入样式
        _injectStyles();
        
        // 启动观察器：监听侧边栏列表渲染
        const observer = new MutationObserver(_debounce(() => {
            _enhanceSidebar();
        }, 300));
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // 监听消息捕获
        _startMessageCapturer();
        
        console.log('[GPH] SidebarOptimizer 已启动');
    };

    /** 注入必要样式 */
    const _injectStyles = () => {
        if (document.getElementById('gph-sidebar-styles')) return;
        const style = document.createElement('style');
        style.id = 'gph-sidebar-styles';
        style.textContent = `
            .gph-conv-optimizer {
                margin-top: 0;
                display: flex;
                flex-direction: column;
                padding: 0 12px 0 32px;
                overflow: hidden;
            }
            .conversation-actions-container {
                height: 48px !important; /* 锁定操作按钮高度，防止随列表扩展而偏移 */
                top: 0 !important;
            }
            .gph-conv-toggle-btn {
                background: transparent;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                color: var(--gem-sys-color--on-surface-variant, #c4c7c5);
                transition: background-color 0.2s;
            }
            .gph-conv-toggle-btn:hover {
                background-color: var(--mat-app-ripple-color, rgba(255,255,255,0.05));
            }
            .gph-conv-toggle-btn.gph-expanded .gph-icon {
                transform: rotate(180deg);
            }
            .gph-icon {
                font-family: 'Google Symbols';
                font-size: 20px;
                transition: transform 0.2s;
                user-select: none;
            }
            .gph-msg-list {
                display: none;
                flex-direction: column;
                gap: 4px;
                max-height: 300px;
                overflow-y: auto;
                overflow-x: hidden; /* 防止出现水平滚动条 */
                padding: 4px 6px 12px 0; /* 留出一点右边距给滚动条 */
                scrollbar-width: thin;
                border-top: 1px solid rgba(255,255,255,0.05);
                margin-top: 4px;
            }
            .gph-msg-list::-webkit-scrollbar { width: 4px; }
            .gph-msg-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
            .gph-conv-item-expanded .gph-msg-list {
                display: flex;
            }
            .gph-msg-item {
                padding: 8px 12px;
                font-size: 11px;
                line-height: 1.4;
                color: var(--gem-sys-color--on-surface-variant, #c4c7c5);
                background: rgba(255,255,255,0.02);
                border-radius: 8px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                margin-bottom: 2px;
                width: 100%;
                box-sizing: border-box; /* 确保 padding 不撑开宽度 */
            }
            .gph-msg-item:hover {
                background: var(--mat-app-ripple-color, rgba(255,255,255,0.08));
                border-color: rgba(255,255,255,0.1);
                color: var(--gem-sys-color--on-surface, #fff);
                /* 移除 translateX(2px) 以避免触发水平滚动，改用轻微背景加深 */
            }
            .gph-msg-item:active {
                background: rgba(255,255,255,0.12);
            }
        `;
        document.head.appendChild(style);
    };

    /** 优化侧边栏：添加折叠列表容器 */
    const _enhanceSidebar = async () => {
        const platform = PlatformAdapter.getActive() || PlatformAdapter.detect();
        if (!platform || !platform.sidebarItemSelector) return;

        const items = document.querySelectorAll(platform.sidebarItemSelector);
        if (items.length === 0) return;

        const history = await _getHistory();

        items.forEach(item => {
            const convId = _extractConvId(item.href);
            if (!convId) return;

            const parent = item.closest('.conversation-items-container') || item.parentElement;
            if (parent.querySelector('.gph-conv-optimizer')) return;

            // 1. 查找或创建操作容器
            const actionsContainer = parent.querySelector('.conversation-actions-container');
            if (actionsContainer && !actionsContainer.querySelector('.gph-conv-toggle-btn')) {
                const btn = document.createElement('button');
                btn.className = 'gph-conv-toggle-btn';
                btn.setAttribute('aria-label', '展开历史消息');
                btn.innerHTML = '<span class="gph-icon">expand_more</span>';
                
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const state = container.classList.toggle('gph-conv-item-expanded');
                    btn.classList.toggle('gph-expanded', state);
                };
                
                // 插入到三点菜单按钮左侧
                const menuBtn = actionsContainer.querySelector('[data-test-id="actions-menu-button"]');
                if (menuBtn) {
                    actionsContainer.insertBefore(btn, menuBtn);
                } else {
                    actionsContainer.appendChild(btn);
                }
            }

            // 2. 创建消息列表容器
            const container = document.createElement('div');
            container.className = 'gph-conv-optimizer';
            
            const msgList = document.createElement('div');
            msgList.className = 'gph-msg-list';

            container.appendChild(msgList);
            parent.appendChild(container);

            // 渲染已存储的消息
            if (history[convId]) {
                _renderMessageList(msgList, history[convId]);
            }
        });
    };

    /** 渲染消息列表 */
    const _renderMessageList = (container, messages) => {
        container.innerHTML = '';
        messages.forEach((msg, idx) => {
            const el = document.createElement('div');
            el.className = 'gph-msg-item';
            el.textContent = msg;
            el.title = msg;
            el.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const currentConvId = _extractConvId(window.location.href);
                const targetConvId = _extractConvId(container.parentElement.querySelector('a').href);
                
                if (currentConvId === targetConvId) {
                    _jumpToMessage(idx);
                } else {
                    // 如果不是当前会话，先点击父级 a 标签进行导航
                    const link = container.parentElement.querySelector('a');
                    if (link) {
                        link.click();
                        // 导航后由于页面刷新/组件重载，较难直接跳转，这里通过提示告知用户
                        console.log('[GPH] 正在切换会话...');
                        // 尝试在加载后跳转（视情况而定，这里简单处理）
                        setTimeout(() => _jumpToMessage(idx), 2000);
                    }
                }
            };
            container.appendChild(el);
        });
    };

    /** 捕获当前会话的消息 */
    const _startMessageCapturer = () => {
        const observer = new MutationObserver(_debounce(() => {
            _captureCurrentMessages();
        }, 1500));
        
        // 观察主体内容区
        const main = document.querySelector('main') || document.body;
        observer.observe(main, { childList: true, subtree: true });
        
        console.log('[GPH] MessageCapturer 已启动');
    };

    /** 捕获并存储当前会话的消息 */
    const _captureCurrentMessages = async () => {
        if (_capturing) return;
        _capturing = true;

        const platform = PlatformAdapter.getActive() || PlatformAdapter.detect();
        if (!platform || !platform.userMessageSelector) {
            _capturing = false;
            return;
        }

        const convId = _extractConvId(window.location.href);
        if (!convId) {
            _capturing = false;
            return;
        }

        // 获取当前界面上的所有用户消息
        const userQueries = document.querySelectorAll(platform.userMessageSelector);
        if (userQueries.length === 0) {
            _capturing = false;
            return;
        }

        const currentMessages = Array.from(userQueries).map(el => el.innerText.trim()).filter(t => t);
        
        const history = await _getHistory();
        const oldMessages = history[convId] || [];

        // 如果有变化则更新
        if (JSON.stringify(oldMessages) !== JSON.stringify(currentMessages)) {
            history[convId] = currentMessages;
            await _saveHistory(history);
            
            // 通知 UI 更新
            const sidebarItem = document.querySelector(`a[href*="${convId}"]`);
            if (sidebarItem) {
                const parent = sidebarItem.closest('.conversation-items-container') || sidebarItem.parentElement;
                const msgList = parent.querySelector('.gph-msg-list');
                if (msgList) {
                    _renderMessageList(msgList, currentMessages);
                }
            }
        }

        _capturing = false;
    };

    /** 跳转到指定序号的消息（Gemini 页面内滚动） */
    const _jumpToMessage = (index) => {
        const platform = PlatformAdapter.getActive() || PlatformAdapter.detect();
        if (!platform || !platform.userMessageSelector) return;

        const userQueries = document.querySelectorAll(platform.userMessageSelector);
        if (userQueries[index]) {
            userQueries[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 可以加个高亮效果
            const originalBg = userQueries[index].style.backgroundColor;
            userQueries[index].style.backgroundColor = 'rgba(0, 122, 204, 0.2)';
            setTimeout(() => {
                userQueries[index].style.backgroundColor = originalBg;
            }, 2000);
        }
    };

    /** 从 URL 提取会话 ID */
    const _extractConvId = (url) => {
        const match = url.match(/\/app\/([a-z0-9]+)/);
        return match ? match[1] : null;
    };

    /** 获取存储的历史数据 */
    const _getHistory = () => {
        return new Promise(resolve => {
            chrome.storage.local.get([STORAGE_KEY], (res) => {
                resolve(res[STORAGE_KEY] || {});
            });
        });
    };

    /** 保存历史数据 */
    const _saveHistory = (data) => {
        return new Promise(resolve => {
            chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
        });
    };

    /** 防抖函数 */
    const _debounce = (fn, delay) => {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    return { init };
})();
