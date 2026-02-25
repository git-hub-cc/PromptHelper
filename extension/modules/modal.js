/**
 * ModalManager - 模态弹窗系统
 * 提供统一的模态弹窗创建、关闭和事件处理
 */
var ModalManager = (() => {

    /**
     * 显示模态弹窗
     * @param {Object} options
     * @param {string} options.title - 弹窗标题
     * @param {string} options.contentHTML - 弹窗主体 HTML
     * @param {Function} [options.onConfirm] - 确认回调 (overlay, closeModal) => void
     * @param {Function} [options.onCancel] - 取消回调
     * @param {string} [options.confirmText='确认'] - 确认按钮文字
     * @param {string} [options.cancelText='取消'] - 取消按钮文字
     * @param {boolean} [options.showCancel=true] - 是否显示取消按钮
     * @returns {HTMLElement} overlay 元素
     */
    const show = ({
        title,
        contentHTML,
        onConfirm,
        onCancel,
        confirmText = '确认',
        cancelText = '取消',
        showCancel = true
    }) => {
        /* --- 移除已有弹窗 --- */
        const existing = document.getElementById('gph-modal-overlay');
        if (existing) existing.remove();

        /* --- 构建弹窗容器 --- */
        const container = document.createElement('div');
        container.id = 'gph-modal-container';
        container.setAttribute('role', 'dialog');
        container.setAttribute('aria-modal', 'true');
        container.setAttribute('aria-labelledby', 'gph-modal-title');

        const esc = PlatformAdapter.escapeHTML;

        const modalContent = `
            <div id="gph-modal-header">
                <h4 id="gph-modal-title">${esc(title)}</h4>
                <button id="gph-modal-close" class="gph-modal-close-btn" aria-label="关闭">&times;</button>
            </div>
            <div id="gph-modal-body"></div>
            <div id="gph-modal-footer">
                ${showCancel ? `<button id="gph-modal-cancel" class="gph-btn gph-btn-secondary">${esc(cancelText)}</button>` : ''}
                <button id="gph-modal-ok" class="gph-btn gph-btn-primary">${esc(confirmText)}</button>
            </div>`;

        PlatformAdapter.setSafeHTML(container, modalContent);
        PlatformAdapter.setSafeHTML(container.querySelector('#gph-modal-body'), contentHTML);

        /* --- 构建遮罩层 --- */
        const overlay = document.createElement('div');
        overlay.id = 'gph-modal-overlay';
        overlay.className = 'gph-modal-overlay';
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        /* --- 关闭函数 --- */
        const closeModal = () => {
            const okBtn = overlay.querySelector('#gph-modal-ok');
            if (okBtn) okBtn.replaceWith(okBtn.cloneNode(true));
            overlay.remove();
        };

        /* --- 绑定事件 --- */
        overlay.querySelector('#gph-modal-ok').addEventListener('click', () => {
            if (onConfirm) onConfirm(overlay, closeModal);
        });

        if (showCancel) {
            overlay.querySelector('#gph-modal-cancel')
                .addEventListener('click', () => { if (onCancel) onCancel(); closeModal(); });
        }

        overlay.querySelector('#gph-modal-close')
            .addEventListener('click', () => { if (onCancel) onCancel(); closeModal(); });

        return overlay;
    };

    /**
     * 快捷信息弹窗
     * @param {string} title
     * @param {string} message
     * @param {string} [btnText='好的']
     */
    const alert = (title, message, btnText = '好的') => {
        return show({
            title,
            contentHTML: `<p>${message}</p>`,
            showCancel: false,
            confirmText: btnText,
            onConfirm: (_modal, close) => close()
        });
    };

    /**
     * 快捷确认弹窗
     * @param {string} title
     * @param {string} message
     * @param {Function} onYes
     */
    const confirm = (title, message, onYes) => {
        return show({
            title,
            contentHTML: `<p>${message}</p>`,
            confirmText: '确认',
            cancelText: '取消',
            onConfirm: (_modal, close) => { onYes(); close(); }
        });
    };

    return { show, alert, confirm };
})();
