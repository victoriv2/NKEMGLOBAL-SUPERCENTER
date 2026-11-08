// Custom Modular Dialogs & Notifications (Replacing Native Alert / Confirm / Prompt)
// Strictly Flat: No glow, no shadow, no gradients, no vertical hover lift

// Deterministic Currency & Number Formatter (Always Comma 300,000 - Never 300.000)
window.formatPrice = function(val) {
  if (val === undefined || val === null || isNaN(val)) return '0';
  const num = Math.round(Number(val));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

window.formatNaira = function(val) {
  return '₦' + window.formatPrice(val);
};

// Universal Name Auto-Capitalizer (First letters capitalized)
window.capitalizeName = function(val) {
  if (!val) return '';
  return String(val)
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

window.attachNameAutoCapitalize = function(input) {
  if (!input) return;
  input.style.textTransform = 'capitalize';
  input.addEventListener('input', () => {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.replace(/(?:^|\s)\S/g, char => char.toUpperCase());
    try {
      input.setSelectionRange(start, end);
    } catch (_) {}
  });
  input.addEventListener('blur', () => {
    input.value = window.capitalizeName(input.value);
  });
};

window.CustomModal = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'custom-modal-root';
      document.body.appendChild(this.container);
    }
  },

  /**
   * Custom Alert Dialog
   */
  alert({ title = 'Notice', message = '', buttonText = 'Acknowledge', type = 'info' }) {
    this.init();
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'c-modal-overlay active';

      overlay.innerHTML = `
        <div class="c-modal-box">
          <div class="c-modal-header">
            <div class="c-modal-title-wrap">
              <span class="c-modal-type-indicator ${type}"></span>
              <h3 class="c-modal-title">${this.escape(title)}</h3>
            </div>
            <button class="c-modal-close-btn" aria-label="Close" type="button">
              ${window.renderIcon('close')}
            </button>
          </div>
          <div class="c-modal-body">
            <p class="c-modal-text">${this.escape(message)}</p>
          </div>
          <div class="c-modal-footer">
            <button class="btn btn-primary c-modal-action-btn" type="button">${this.escape(buttonText)}</button>
          </div>
        </div>
      `;

      const close = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 150);
        resolve();
      };

      overlay.querySelector('.c-modal-close-btn').addEventListener('click', close);
      overlay.querySelector('.c-modal-action-btn').addEventListener('click', close);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });

      this.container.appendChild(overlay);
    });
  },

  /**
   * Custom Confirmation Dialog
   */
  confirm({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Proceed',
    cancelText = 'Cancel',
    isDanger = false,
    onConfirm = null,
    onCancel = null
  }) {
    this.init();
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'c-modal-overlay active';

      overlay.innerHTML = `
        <div class="c-modal-box">
          <div class="c-modal-header">
            <div class="c-modal-title-wrap">
              <span class="c-modal-type-indicator ${isDanger ? 'danger' : 'warning'}"></span>
              <h3 class="c-modal-title">${this.escape(title)}</h3>
            </div>
            <button class="c-modal-close-btn" aria-label="Close" type="button">
              ${window.renderIcon('close')}
            </button>
          </div>
          <div class="c-modal-body">
            <p class="c-modal-text">${this.escape(message)}</p>
          </div>
          <div class="c-modal-footer dual-actions">
            <button class="btn btn-secondary c-modal-cancel-btn" type="button">${this.escape(cancelText)}</button>
            <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} c-modal-confirm-btn" type="button">${this.escape(confirmText)}</button>
          </div>
        </div>
      `;

      const finish = (result) => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 150);
        try {
          if (result === true && typeof onConfirm === 'function') onConfirm();
          if (result === false && typeof onCancel === 'function') onCancel();
        } catch (err) {
          console.error(err);
        }
        resolve(result);
      };

      overlay.querySelector('.c-modal-close-btn').addEventListener('click', () => finish(null));
      overlay.querySelector('.c-modal-cancel-btn').addEventListener('click', () => finish(false));
      overlay.querySelector('.c-modal-confirm-btn').addEventListener('click', () => finish(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(null);
      });

      this.container.appendChild(overlay);
    });
  },

  /**
   * Custom Input Prompt
   */
  prompt({
    title = 'Input Required',
    message = '',
    placeholder = '',
    defaultValue = '',
    confirmText = 'Submit',
    cancelText = 'Cancel',
    onConfirm = null,
    onCancel = null
  }) {
    this.init();
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'c-modal-overlay active';

      overlay.innerHTML = `
        <div class="c-modal-box">
          <div class="c-modal-header">
            <h3 class="c-modal-title">${this.escape(title)}</h3>
            <button class="c-modal-close-btn" aria-label="Close" type="button">
              ${window.renderIcon('close')}
            </button>
          </div>
          <div class="c-modal-body">
            ${message ? `<p class="c-modal-text">${this.escape(message)}</p>` : ''}
            <div class="form-group" style="margin-top: 10px;">
              <input type="text" class="input-field c-modal-input" placeholder="${this.escape(placeholder)}" value="${this.escape(defaultValue)}" />
            </div>
          </div>
          <div class="c-modal-footer dual-actions">
            <button class="btn btn-secondary c-modal-cancel-btn" type="button">${this.escape(cancelText)}</button>
            <button class="btn btn-primary c-modal-confirm-btn" type="button">${this.escape(confirmText)}</button>
          </div>
        </div>
      `;

      const input = overlay.querySelector('.c-modal-input');
      const finish = (val) => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 150);
        try {
          if (val !== null && typeof onConfirm === 'function') onConfirm(val);
          if (val === null && typeof onCancel === 'function') onCancel();
        } catch (err) {
          console.error(err);
        }
        resolve(val);
      };

      overlay.querySelector('.c-modal-close-btn').addEventListener('click', () => finish(null));
      overlay.querySelector('.c-modal-cancel-btn').addEventListener('click', () => finish(null));
      overlay.querySelector('.c-modal-confirm-btn').addEventListener('click', () => finish(input.value.trim()));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(input.value.trim());
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish(null);
      });

      this.container.appendChild(overlay);
      setTimeout(() => input.focus(), 100);
    });
  },

  /**
   * Custom Toast Notifications
   */
  toast({ message = '', type = 'info', duration = 3500 }) {
    let toastContainer = document.getElementById('custom-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'custom-toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `c-toast-item ${type}`;
    toast.innerHTML = `
      <div class="c-toast-content">
        <span class="c-toast-badge ${type}"></span>
        <span class="c-toast-msg">${this.escape(message)}</span>
      </div>
      <button class="c-toast-close" type="button" aria-label="Close">
        ${window.renderIcon('close')}
      </button>
    `;

    const remove = () => {
      toast.classList.add('fading');
      setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector('.c-toast-close').addEventListener('click', remove);
    setTimeout(remove, duration);

    toastContainer.appendChild(toast);
  },

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

// Safe fallback rerouting for any native browser dialogs
window.alert = (msg) => window.CustomModal.alert({ message: msg });

// Universal cursor-at-end placement across all type inputs & textareas
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
  const supported = ['text', 'search', 'tel', 'email', 'password', 'url', 'number'];
  if (el.tagName === 'INPUT' && el.type && !supported.includes(el.type)) return;

  const len = el.value ? el.value.length : 0;
  if (len > 0 && typeof el.setSelectionRange === 'function') {
    setTimeout(() => {
      try {
        el.setSelectionRange(len, len);
      } catch (_) {}
    }, 15);
  }
});

document.addEventListener('mouseup', (e) => {
  const el = e.target;
  if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
  const supported = ['text', 'search', 'tel', 'email', 'password', 'url', 'number'];
  if (el.tagName === 'INPUT' && el.type && !supported.includes(el.type)) return;

  // If clicked and browser placed cursor at index 0 on a non-empty field, reposition to end
  if (el.selectionStart === 0 && el.selectionEnd === 0 && el.value && el.value.length > 0) {
    const len = el.value.length;
    setTimeout(() => {
      try {
        el.setSelectionRange(len, len);
      } catch (_) {}
    }, 15);
  }
});
