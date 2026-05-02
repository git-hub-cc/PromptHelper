/**
 * SidebarOptimizer - Gemini 侧边栏优化模块
 * 允许在侧边栏显示用户发送的消息（默认折叠），方便快速定位。
 */
class SidebarOptimizer {
    constructor(platformAdapter) {
        this.STORAGE_KEY = 'gph_conv_history';
        this._capturing = false;
        this.platformAdapter = platformAdapter;
    }

    /** 初始化 */
    init() {
        if (!window.location.hostname.includes('gemini.google.com')) return;

        // 启动观察器：监听侧边栏列表渲染
        const observer = new MutationObserver(this._debounce(() => {
            this._enhanceSidebar().catch(console.error);
        }, 300));

        observer.observe(document.body, { childList: true, subtree: true });

        // 监听消息捕获
        this._startMessageCapturer();

        console.log('[GPH] SidebarOptimizer 已启动');
    }

    /** 优化侧边栏：添加折叠列表容器 */
    async _enhanceSidebar() {
        const platform = this.platformAdapter.getActive() || this.platformAdapter.detect();
        if (!platform || !platform.sidebarItemSelector) return;

        const items = document.querySelectorAll(platform.sidebarItemSelector);
        if (items.length === 0) return;

        const history = await this._getHistory();

        items.forEach(item => {
            const convId = this._extractConvId(item.href);
            if (!convId) return;

            const parent = item.closest('.conversation-items-container') || item.parentElement;

            // 1. 确保消息列表容器存在 (始终首先检查/创建容器，供按钮绑定使用)
            let container = parent.querySelector('.gph-conv-optimizer');
            if (!container) {
                container = document.createElement('div');
                container.className = 'gph-conv-optimizer';

                const msgList = document.createElement('div');
                msgList.className = 'gph-msg-list';

                // 使用事件委托处理点击事件
                msgList.addEventListener('click', (e) => this._handleMessageClick(e, msgList));

                container.appendChild(msgList);
                parent.appendChild(container);

                // 渲染已存储的消息
                if (history[convId]) {
                    this._renderMessageList(msgList, history[convId]);
                }
            }

            // 2. 查找或创建操作按钮容器中的折叠按钮
            const actionsContainer = parent.querySelector('.conversation-actions-container');
            if (actionsContainer && !actionsContainer.querySelector('.gph-conv-toggle-btn')) {
                const btn = document.createElement('button');
                btn.className = 'gph-conv-toggle-btn';
                btn.setAttribute('aria-label', '展开历史消息');
                btn.innerHTML = '<span class="gph-icon">expand_more</span>';

                // 闭包引用正确的 container
                const targetContainer = container;
                btn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // 切换 UI 状态
                    const state = targetContainer.classList.toggle('gph-conv-item-expanded');
                    btn.classList.toggle('gph-expanded', state);

                    // --- 修复点：展开时动态检查并尝试获取数据 ---
                    if (state) {
                        const msgList = targetContainer.querySelector('.gph-msg-list');
                        const currentConvId = this._extractConvId(window.location.href);
                        const history = await this._getHistory();
                        const messages = history[convId] || [];

                        if (messages.length === 0) {
                            if (currentConvId === convId) {
                                // 场景 1：是当前正在浏览的对话，直接强制立即捕获
                                msgList.innerHTML = '<div class="gph-msg-item" style="color:#a0a4ab; text-align:center; pointer-events:none;">正在获取内容...</div>';
                                await this._captureCurrentMessages();
                            } else {
                                // 场景 2：是其他历史对话且无缓存，必须提示用户点击进入
                                msgList.innerHTML = '<div class="gph-msg-item" style="color:#a0a4ab; text-align:center; pointer-events:none; font-style:italic;">暂无缓存记录，请先点击标题加载该对话</div>';
                            }
                        } else {
                            // 场景 3：本地已有数据，重新渲染一次保证是最新的
                            this._renderMessageList(msgList, messages);
                        }
                    }
                };

                // 插入到三点菜单按钮左侧
                const menuBtn = actionsContainer.querySelector('[data-test-id="actions-menu-button"]');
                if (menuBtn) {
                    actionsContainer.insertBefore(btn, menuBtn);
                } else {
                    actionsContainer.appendChild(btn);
                }
            }
        });
    }

    /** 处理消息点击 (事件委托) */
    _handleMessageClick(e, container) {
        const targetItem = e.target.closest('.gph-msg-item');
        if (!targetItem) return;

        e.preventDefault();
        e.stopPropagation();

        const idx = parseInt(targetItem.dataset.index, 10);
        if (isNaN(idx)) return;

        const currentConvId = this._extractConvId(window.location.href);
        const parent = container.closest('.conversation-items-container') || container.parentElement;
        const link = parent.querySelector('a');
        if (!link) return;

        const targetConvId = this._extractConvId(link.href);

        if (currentConvId === targetConvId) {
            this._jumpToMessage(idx);
        } else {
            link.click();
            console.log('[GPH] 正在切换会话...');

            // 循环检查是否加载完成并跳转
            let attempts = 0;
            const checkAndJump = setInterval(() => {
                const newConvId = this._extractConvId(window.location.href);
                if (newConvId === targetConvId) {
                    const platform = this.platformAdapter.getActive() || this.platformAdapter.detect();
                    const userQueries = document.querySelectorAll(platform?.userMessageSelector || '.query-content');
                    if (userQueries.length > 0) {
                        clearInterval(checkAndJump);
                        setTimeout(() => this._jumpToMessage(idx), 500);
                    }
                }
                if (++attempts > 20) clearInterval(checkAndJump);
            }, 500);
        }
    }

    /** 渲染消息列表 */
    _renderMessageList(container, messages) {
        container.innerHTML = '';
        messages.forEach((msg, idx) => {
            const el = document.createElement('div');
            el.className = 'gph-msg-item';
            el.textContent = msg;
            el.title = msg;
            el.dataset.index = idx; // 保存索引供事件委托使用
            container.appendChild(el);
        });
    }

    /** 捕获当前会话的消息 */
    _startMessageCapturer() {
        const observer = new MutationObserver(this._debounce(() => {
            this._captureCurrentMessages().catch(console.error);
        }, 1500));

        // 观察主体内容区
        const main = document.querySelector('main') || document.body;
        observer.observe(main, { childList: true, subtree: true });

        console.log('[GPH] MessageCapturer 已启动');
    }

    /** 捕获并存储当前会话的消息 */
    async _captureCurrentMessages() {
        if (this._capturing) return;
        this._capturing = true;

        const platform = this.platformAdapter.getActive() || this.platformAdapter.detect();
        if (!platform || !platform.userMessageSelector) {
            this._capturing = false;
            return;
        }

        const convId = this._extractConvId(window.location.href);
        if (!convId) {
            this._capturing = false;
            return;
        }

        // 获取当前界面上的所有用户消息
        const userQueries = document.querySelectorAll(platform.userMessageSelector);
        if (userQueries.length === 0) {
            this._capturing = false;
            return;
        }

        const currentMessages = Array.from(userQueries).map(el => {
            let text = el.innerText.trim();
            // 去除开头的“你说”或“You said”等多语言前缀
            text = text.replace(/^(你说|You said)[:：]?[\s\n]*/i, '');
            // 批量替换连续换行为单个空格，保持侧边栏单行紧凑显示
            return text.replace(/\n+/g, ' ').trim();
        }).filter(t => t);

        const history = await this._getHistory();
        const oldMessages = history[convId] || [];

        // 如果有变化则更新
        if (JSON.stringify(oldMessages) !== JSON.stringify(currentMessages)) {
            history[convId] = currentMessages;
            await this._saveHistory(history);

            // 通知 UI 更新
            const sidebarItem = document.querySelector(`a[href*="${convId}"]`);
            if (sidebarItem) {
                const parent = sidebarItem.closest('.conversation-items-container') || sidebarItem.parentElement;
                const msgList = parent.querySelector('.gph-msg-list');
                if (msgList) {
                    this._renderMessageList(msgList, currentMessages);
                }
            }
        }

        this._capturing = false;
    }

    /** 跳转到指定序号的消息（Gemini 页面内滚动） */
    _jumpToMessage(index) {
        const platform = this.platformAdapter.getActive() || this.platformAdapter.detect();
        if (!platform || !platform.userMessageSelector) return;

        const performJump = () => {
            const userQueries = document.querySelectorAll(platform.userMessageSelector);
            const target = userQueries[index];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // 添加视觉反馈
                target.classList.add('gph-highlight-pulse');
                setTimeout(() => {
                    target.classList.remove('gph-highlight-pulse');
                }, 2000);

                // 再次校验位置（针对某些动态高度加载的情况）
                setTimeout(() => {
                    const rect = target.getBoundingClientRect();
                    if (rect.top < 0 || rect.bottom > window.innerHeight) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 1000);
            }
        };

        performJump();
    }

    /** 从 URL 提取会话 ID */
    _extractConvId(url) {
        const match = url.match(/\/app\/([a-z0-9]+)/);
        return match ? match[1] : null;
    }

    /** 获取存储的历史数据 */
    async _getHistory() {
        const res = await chrome.storage.local.get([this.STORAGE_KEY]);
        return res[this.STORAGE_KEY] || {};
    }

    /** 保存历史数据 */
    async _saveHistory(data) {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: data });
    }

    /** 防抖函数 */
    _debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
}