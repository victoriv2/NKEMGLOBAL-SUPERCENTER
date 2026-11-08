// Custom Modular Picker (Zero Native <select> Elements)
// Desktop: Centered Custom Modal Dialog
// Mobile: Bottom Sheet Modal / Action Sheet
// Fully responsive, searchable, strictly flat design
window.CustomPicker = {
  activeInstance: null,

  create({
    container,
    id = '',
    title = 'Select Option',
    options = [], // [{ value: '...', label: '...' }] or array of strings
    value = '',
    placeholder = 'Select an option...',
    searchable = true,
    onChange = null
  }) {
    if (!container) return null;

    // Normalize options
    let normalizedOptions = this.normalizeOptions(options);
    let currentValue = value !== undefined && value !== null ? String(value) : '';
    let isDisabled = false;

    // Build Trigger element inside container
    container.innerHTML = '';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'c-picker-trigger';
    if (id) trigger.id = id;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'c-picker-label';
    
    const iconSpan = document.createElement('span');
    iconSpan.className = 'c-picker-icon';
    iconSpan.innerHTML = window.renderIcon('chevronDown');

    trigger.appendChild(labelSpan);
    trigger.appendChild(iconSpan);
    container.appendChild(trigger);

    const updateLabel = () => {
      const selected = normalizedOptions.find(o => String(o.value) === String(currentValue));
      if (selected) {
        labelSpan.textContent = selected.label;
        labelSpan.classList.remove('placeholder');
      } else {
        labelSpan.textContent = placeholder;
        labelSpan.classList.add('placeholder');
      }
    };
    updateLabel();

    // Trigger click handler -> Opens Modal (Desktop) or Bottom Sheet (Mobile)
    trigger.addEventListener('click', () => {
      if (isDisabled) return;
      this.openDialog({
        title,
        options: normalizedOptions,
        currentValue,
        searchable: searchable && normalizedOptions.length > 5,
        onSelect: (selectedVal) => {
          currentValue = String(selectedVal);
          updateLabel();
          if (typeof onChange === 'function') {
            const opt = normalizedOptions.find(o => String(o.value) === String(currentValue));
            onChange(currentValue, opt);
          }
          // Dispatch custom event on trigger
          trigger.dispatchEvent(new CustomEvent('change', {
            detail: { value: currentValue },
            bubbles: true
          }));
        }
      });
    });

    return {
      getValue() {
        return currentValue;
      },
      setValue(newVal) {
        currentValue = newVal !== undefined && newVal !== null ? String(newVal) : '';
        updateLabel();
      },
      setOptions(newOpts, keepValue = false) {
        normalizedOptions = window.CustomPicker.normalizeOptions(newOpts);
        if (!keepValue || !normalizedOptions.some(o => String(o.value) === String(currentValue))) {
          currentValue = '';
        }
        updateLabel();
      },
      setDisabled(disabled) {
        isDisabled = !!disabled;
        trigger.disabled = isDisabled;
        if (isDisabled) {
          trigger.classList.add('disabled');
        } else {
          trigger.classList.remove('disabled');
        }
      },
      destroy() {
        container.innerHTML = '';
      }
    };
  },

  normalizeOptions(options) {
    if (!Array.isArray(options)) return [];
    return options.map(item => {
      if (typeof item === 'object' && item !== null) {
        return {
          value: String(item.value !== undefined ? item.value : item.label),
          label: String(item.label !== undefined ? item.label : item.value)
        };
      }
      return {
        value: String(item),
        label: String(item)
      };
    });
  },

  /**
   * Opens custom picker dialog (Modal on Desktop, Bottom Sheet on Mobile)
   */
  openDialog({ title, options, currentValue, searchable, onSelect }) {
    // Remove any currently open dialog
    const existing = document.getElementById('c-picker-active-dialog');
    if (existing) existing.remove();

    const isMobile = window.innerWidth < 768;

    const overlay = document.createElement('div');
    overlay.id = 'c-picker-active-dialog';
    overlay.className = `c-picker-overlay active ${isMobile ? 'mobile-sheet' : 'desktop-modal'}`;

    overlay.innerHTML = `
      <div class="c-picker-sheet-box">
        ${isMobile ? '<div class="c-sheet-drag-handle"></div>' : ''}
        <div class="c-picker-sheet-header">
          <div class="c-picker-sheet-title-wrap">
            <h3 class="c-picker-sheet-title">${this.escape(title)}</h3>
            <span class="c-picker-sheet-count">${options.length} items</span>
          </div>
          <button class="c-picker-sheet-close-btn" type="button" aria-label="Close">
            ${window.renderIcon('close')}
          </button>
        </div>

        ${searchable ? `
        <div class="c-picker-search-wrap">
          <div class="c-picker-search-box">
            <span class="c-picker-search-icon">${window.renderIcon('search')}</span>
            <input type="text" class="c-picker-search-input" placeholder="Search ${this.escape(title)}..." />
          </div>
        </div>
        ` : ''}

        <div class="c-picker-options-list">
          <!-- Rendered dynamically -->
        </div>
      </div>
    `;

    const optionsContainer = overlay.querySelector('.c-picker-options-list');
    const searchInput = overlay.querySelector('.c-picker-search-input');
    const closeBtn = overlay.querySelector('.c-picker-sheet-close-btn');

    let filteredOptions = [...options];

    const renderList = () => {
      if (filteredOptions.length === 0) {
        optionsContainer.innerHTML = `
          <div class="c-picker-empty">
            <p>No matching options found</p>
          </div>
        `;
        return;
      }

      optionsContainer.innerHTML = filteredOptions.map(opt => {
        const isSelected = String(opt.value) === String(currentValue);
        return `
          <button type="button" class="c-picker-option-item ${isSelected ? 'selected' : ''}" data-val="${this.escape(opt.value)}">
            <span class="c-picker-opt-label">${this.escape(opt.label)}</span>
            <span class="c-picker-opt-check">${isSelected ? window.renderIcon('check') : ''}</span>
          </button>
        `;
      }).join('');

      // Attach option click handlers
      optionsContainer.querySelectorAll('.c-picker-option-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-val');
          closeDialog();
          if (onSelect) onSelect(val);
        });
      });
    };

    renderList();

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        filteredOptions = options.filter(opt => 
          opt.label.toLowerCase().includes(query) || opt.value.toLowerCase().includes(query)
        );
        renderList();
      });
    }

    const closeDialog = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 180);
    };

    closeBtn.addEventListener('click', closeDialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog();
    });

    document.body.appendChild(overlay);

    if (searchInput) {
      setTimeout(() => searchInput.focus(), 80);
    }
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
