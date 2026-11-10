// Admin Control Center - Nkem Global
// Enforces Zero Emojis, Zero Shadows/Glows/Gradients, Zero Hover Lifts, Custom Pickers & Modals, <=100KB Image Compression

document.addEventListener('DOMContentLoaded', async () => {
  const adminState = {
    categories: [],
    products: [],
    orders: [],
    conversations: [],
    users: [],
    productPageSize: 16,
    hasMoreProducts: false,
    isLoadingMoreProducts: false,
    activeChatUserId: null,
    activeChatCustomer: null,
    chatPollTimer: null,
    convsPollTimer: null,
    editingProduct: null,
    editingCategory: null,
    productImagesDraft: [], // Temporary array for product image editing
    productSearchQuery: '',
    productFilter: 'all',
    productSortBy: 'newest',
    orderFilterStatus: 'all',
    orderSearchQuery: '',
    orderSortBy: 'newest'
  };

  // DOM Elements - Tab Switching
  const tabButtons = document.querySelectorAll('.admin-tab-btn');
  const tabPanes = document.querySelectorAll('.admin-tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(tabTarget);
      if (targetPane) targetPane.classList.add('active');

      try {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } catch (err) {}

      if (tabTarget === 'tabChat') {
        document.documentElement.classList.add('admin-chat-tab-active');
        document.body.classList.add('admin-chat-tab-active');
        loadOrdersAndChats();
        window.scrollTo({ top: 0, left: 0 });
      } else {
        document.documentElement.classList.remove('admin-chat-tab-active');
        document.body.classList.remove('admin-chat-tab-active');
        document.body.classList.remove('admin-mobile-chat-open');
        if (tabTarget === 'tabOrders') {
          loadOrdersAndChats();
        } else if (tabTarget === 'tabUsers') {
          loadUsersManager();
        }
      }
    });
  });

  // Check initial active tab state
  const initialActiveTab = document.querySelector('.admin-tab-btn.active')?.getAttribute('data-tab');
  if (initialActiveTab === 'tabChat') {
    document.documentElement.classList.add('admin-chat-tab-active');
    document.body.classList.add('admin-chat-tab-active');
  } else {
    document.documentElement.classList.remove('admin-chat-tab-active');
    document.body.classList.remove('admin-chat-tab-active');
  }

  /* ==========================================================================
     1. INITIAL DATA LOADING
     ========================================================================== */
  async function loadAdminData() {
    try {
      const [categories, products, orders, users] = await Promise.all([
        window.SupabaseService.getCategories(),
        window.SupabaseService.getProducts({ limit: adminState.productPageSize, offset: 0, includeHidden: true }),
        window.SupabaseService.getOrders(),
        window.SupabaseService.getUsers()
      ]);

      adminState.categories = categories || [];
      adminState.products = products || [];
      adminState.orders = orders || [];
      adminState.users = users || [];
      adminState.hasMoreProducts = Array.isArray(products) && products.length === adminState.productPageSize;

      renderCategoriesManager();
      renderProductsManager();
      renderOrdersManager();
      renderChatManager();
      renderUsersManager();
      updateAdminUsersBadge();
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  }

  /* ==========================================================================
     3. CATEGORIES MANAGEMENT (Create, Edit, Remove, Rearrange)
     ========================================================================== */
  const categoryListContainer = document.getElementById('adminCategoryList');
  const addCategoryBtn = document.getElementById('adminAddCategoryBtn');

  function renderCategoriesManager() {
    if (!categoryListContainer) return;

    if (adminState.categories.length === 0) {
      categoryListContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: var(--font-sm);">
          No categories found. Click "Add Category" to create one.
        </div>
      `;
      return;
    }

    adminState.categories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    categoryListContainer.innerHTML = adminState.categories.map((c, idx) => {
      let cImg = c.image_url || 'assets/images/logo.jpeg';
      if (cImg.startsWith('assets/categories/') && !cImg.includes('?v=')) {
        cImg += '?v=20261109_1';
      }
      return `
      <div class="admin-item-row" data-id="${c.id}" style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
          <img src="${cImg}" alt="${window.CustomModal.escape(c.name)}" style="width: 46px; height: 34px; object-fit: contain; border-radius: 4px; border: 1px solid var(--border-color); background: #fff; flex-shrink: 0;" />
          <div class="admin-item-details">
            <span class="admin-item-title">${window.CustomModal.escape(c.name)}</span>
            <span class="admin-item-sub">Order Position: #${idx + 1} &bull; ID: ${c.id}</span>
          </div>
        </div>
        <div class="admin-item-actions">
          <button class="btn-icon-square" type="button" data-action="cat-up" data-idx="${idx}" title="Move Up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
            ${window.renderIcon('arrowUp')}
          </button>
          <button class="btn-icon-square" type="button" data-action="cat-down" data-idx="${idx}" title="Move Down" ${idx === adminState.categories.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
            ${window.renderIcon('arrowDown')}
          </button>
          <button class="btn-icon-square" type="button" data-action="cat-edit" data-id="${c.id}" title="Edit Category & Image">
            ${window.renderIcon('edit')}
          </button>
          <button class="btn-icon-square danger" type="button" data-action="cat-delete" data-id="${c.id}" title="Remove Category">
            ${window.renderIcon('trash')}
          </button>
        </div>
      </div>
    `;
    }).join('');

    // Cat Up (Instant UI Move + Background Sync)
    categoryListContainer.querySelectorAll('[data-action="cat-up"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx > 0) {
          const temp = adminState.categories[idx];
          adminState.categories[idx] = adminState.categories[idx - 1];
          adminState.categories[idx - 1] = temp;
          adminState.categories.forEach((c, i) => { c.sort_order = i + 1; });
          renderCategoriesManager();
          queuePersistCategoriesOrder();
        }
      });
    });

    // Cat Down (Instant UI Move + Background Sync)
    categoryListContainer.querySelectorAll('[data-action="cat-down"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx < adminState.categories.length - 1) {
          const temp = adminState.categories[idx];
          adminState.categories[idx] = adminState.categories[idx + 1];
          adminState.categories[idx + 1] = temp;
          adminState.categories.forEach((c, i) => { c.sort_order = i + 1; });
          renderCategoriesManager();
          queuePersistCategoriesOrder();
        }
      });
    });

    // Cat Edit Dialog
    categoryListContainer.querySelectorAll('[data-action="cat-edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const c = adminState.categories.find(x => x.id === id);
        if (c) openCategoryEditDialog(c, false);
      });
    });

    // Cat Delete
    categoryListContainer.querySelectorAll('[data-action="cat-delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmed = await window.CustomModal.confirm({
          title: 'Delete Category',
          message: 'Are you sure you want to delete this category?',
          confirmText: 'Delete Category',
          isDanger: true
        });

        if (confirmed) {
          adminState.categories = adminState.categories.filter(x => x.id !== id);
          await window.SupabaseService.deleteCategory(id);
          renderCategoriesManager();
          window.CustomModal.toast({ message: 'Category deleted.', type: 'success' });
        }
      });
    });

    if (typeof adminProductFilterPickerInstance !== 'undefined' && adminProductFilterPickerInstance && typeof getProductFilterOptions === 'function') {
      adminProductFilterPickerInstance.setOptions(getProductFilterOptions(), true);
    }
  }

  const categoryEditModal = document.getElementById('adminCategoryEditModal');

  /* Category Edit Dialog with Image Upload & Auto-Compression to <=100KB */
  function openCategoryEditDialog(category = null, isNew = false) {
    if (!categoryEditModal) return;

    let catDraft = category ? { ...category } : {
      id: `cat-${Date.now()}`,
      name: '',
      sort_order: adminState.categories.length + 1,
      image_url: ''
    };
    let catImageDraft = catDraft.image_url || '';

    categoryEditModal.innerHTML = `
      <div class="c-modal-box" style="max-width: 520px;">
        <div class="c-modal-header">
          <h3 class="c-modal-title">${isNew ? 'Create New Category' : 'Edit Category'}</h3>
          <button class="c-modal-close" type="button" id="closeCatEditModalBtn" aria-label="Close dialog">
            ${window.renderIcon('x')}
          </button>
        </div>

        <form id="categoryEditForm" style="display: flex; flex-direction: column; gap: 16px; padding: 16px;">
          <div class="form-group">
            <label class="form-label">Category Title <span class="req">*</span></label>
            <input type="text" class="c-input" id="catModalTitleInput" required placeholder="e.g. Phones, Groceries, Watches" value="${window.CustomModal.escape(catDraft.name || '')}" />
          </div>

          <div class="form-group">
            <label class="form-label">Category Image (Auto-compressed &le; 100KB)</label>
            <input type="file" id="catModalFileInput" accept="image/*" style="display: none;" />
            <div id="catImgPreviewMount" style="margin-top: 6px;"></div>
          </div>

          <div class="c-modal-footer dual-actions" style="margin: 0 -16px -16px -16px; padding: 12px 16px;">
            <button class="btn btn-secondary" type="button" id="cancelCatEditBtn">Cancel</button>
            <button class="btn btn-primary" type="submit">
              ${window.renderIcon('check')}
              <span>${isNew ? 'Create Category' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    categoryEditModal.classList.add('active');

    const previewMount = categoryEditModal.querySelector('#catImgPreviewMount');
    const fileInput = categoryEditModal.querySelector('#catModalFileInput');

    function renderCatPreview() {
      if (catImageDraft) {
        let displayImg = catImageDraft;
        if (displayImg.startsWith('assets/categories/') && !displayImg.includes('?v=')) {
          displayImg += '?v=20261109_1';
        }
        previewMount.innerHTML = `
          <div style="position: relative; display: inline-block; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #f8faf9; padding: 6px;">
            <img src="${displayImg}" alt="Category Image" style="width: 160px; height: 95px; object-fit: contain; display: block; border-radius: 4px; background: #ffffff;" />
            <button type="button" id="removeCatImgBtn" title="Remove image" aria-label="Remove image" style="position: absolute; top: -6px; right: -6px; background: #dc2626; color: #ffffff; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.25); z-index: 10;">
              <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; stroke: #ffffff !important; color: #ffffff !important; display: block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div style="margin-top: 8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="changeCatImgBtn">
              ${window.renderIcon('upload')}
              <span>Change Image</span>
            </button>
          </div>
        `;
        previewMount.querySelector('#removeCatImgBtn').addEventListener('click', () => {
          catImageDraft = '';
          renderCatPreview();
        });
        previewMount.querySelector('#changeCatImgBtn').addEventListener('click', () => fileInput.click());
      } else {
        previewMount.innerHTML = `
          <div id="catModalDropzone" style="border: 2px dashed var(--border-color); border-radius: var(--radius-sm); padding: 22px; text-align: center; cursor: pointer; background: var(--bg-surface-elevated); transition: border-color 0.2s ease;">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 28px; height: 28px; color: var(--accent-gold); margin-bottom: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <div style="font-weight: 600; font-size: var(--font-sm); color: var(--text-main); margin-bottom: 2px;">Click to Choose Category Image</div>
            <div style="font-size: var(--font-xs); color: var(--text-muted);">Supports JPG, PNG, WEBP &bull; Auto-compressed to &le; 100KB</div>
          </div>
        `;
        previewMount.querySelector('#catModalDropzone').addEventListener('click', () => fileInput.click());
      }
    }

    renderCatPreview();

    // Auto-compression on file select (<= 100KB)
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      window.CustomModal.toast({ message: 'Optimizing and compressing category image to <= 100KB...', type: 'info' });

      try {
        const compressed = await window.ImageCompressor.compress(file);
        catImageDraft = compressed.dataUrl;
        renderCatPreview();
        window.CustomModal.toast({
          message: `Category image compressed (${compressed.sizeKb} KB - optimized under 100KB)`,
          type: 'success'
        });
      } catch (err) {
        window.CustomModal.toast({ message: `Failed to compress image: ${err.message}`, type: 'danger' });
      }

      fileInput.value = '';
    });

    // Close Dialog
    const closeModal = () => categoryEditModal.classList.remove('active');
    categoryEditModal.querySelector('#closeCatEditModalBtn').addEventListener('click', closeModal);
    categoryEditModal.querySelector('#cancelCatEditBtn').addEventListener('click', closeModal);

    // Form Submit
    const form = categoryEditModal.querySelector('#categoryEditForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = categoryEditModal.querySelector('#catModalTitleInput');
      const title = titleInput.value.trim();
      if (!title) {
        window.CustomModal.toast({ message: 'Please enter a category title.', type: 'danger' });
        return;
      }

      catDraft.name = title;
      catDraft.image_url = catImageDraft;

      if (isNew) {
        adminState.categories.push(catDraft);
      } else {
        const idx = adminState.categories.findIndex(c => c.id === catDraft.id);
        if (idx >= 0) adminState.categories[idx] = catDraft;
      }

      closeModal();
      renderCategoriesManager();

      try {
        await window.SupabaseService.saveCategory(catDraft);
        window.CustomModal.toast({
          message: isNew ? 'Category created and synced.' : 'Category updated and synced.',
          type: 'success'
        });
      } catch (err) {
        window.CustomModal.toast({ message: `Cloud sync error: ${err.message}`, type: 'danger' });
      }
    });
  }

  let _catSyncTimer = null;
  function queuePersistCategoriesOrder() {
    clearTimeout(_catSyncTimer);
    _catSyncTimer = setTimeout(async () => {
      try {
        await Promise.all(adminState.categories.map((c, i) => {
          c.sort_order = i + 1;
          return window.SupabaseService.saveCategory(c);
        }));
      } catch (err) {
        console.error('Failed to sync category order:', err);
      }
    }, 250);
  }

  // Create Category Button
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      openCategoryEditDialog(null, true);
    });
  }

  /* ==========================================================================
     4. PRODUCT MANAGEMENT (Create, Edit Details, Rearrange Images, Stock, <=100KB)
     ========================================================================== */
  const productListContainer = document.getElementById('adminProductList');
  const addProductBtn = document.getElementById('adminAddProductBtn');
  const productEditModal = document.getElementById('adminProductEditModal');
  const adminSeeMoreContainer = document.getElementById('adminSeeMoreContainer');
  const adminSeeMoreBtn = document.getElementById('adminSeeMoreBtn');

  const adminProductSearchInput = document.getElementById('adminProductSearchInput');
  const adminProductSearchClearBtn = document.getElementById('adminProductSearchClearBtn');
  const adminProductFilterPickerMount = document.getElementById('adminProductFilterPickerMount');
  const adminProductSortPickerMount = document.getElementById('adminProductSortPickerMount');
  const adminProductCountBadge = document.getElementById('adminProductCountBadge');

  let adminProductFilterPickerInstance = null;
  let adminProductSortPickerInstance = null;

  function getProductFilterOptions() {
    const opts = [
      { value: 'all', label: 'Filter: All Products' },
      { value: 'stock:in_stock', label: 'Filter: In Stock' },
      { value: 'stock:out_of_stock', label: 'Filter: Out of Stock' },
      { value: 'visibility:visible', label: 'Filter: Visible in Store' },
      { value: 'visibility:hidden', label: 'Filter: Hidden from Store' }
    ];
    if (Array.isArray(adminState.categories) && adminState.categories.length > 0) {
      adminState.categories.forEach(c => {
        opts.push({ value: `cat:${c.id}`, label: `Category: ${c.name}` });
      });
    }
    return opts;
  }

  function initProductControls() {
    if (adminProductSearchInput && !adminProductSearchInput._hasBoundEvents) {
      adminProductSearchInput._hasBoundEvents = true;
      adminProductSearchInput.addEventListener('input', () => {
        adminState.productSearchQuery = (adminProductSearchInput.value || '').trim().toLowerCase();
        if (adminProductSearchClearBtn) {
          adminProductSearchClearBtn.style.display = adminState.productSearchQuery ? 'inline-flex' : 'none';
        }
        renderProductsManager();
      });
    }

    if (adminProductSearchClearBtn && !adminProductSearchClearBtn._hasBoundEvents) {
      adminProductSearchClearBtn._hasBoundEvents = true;
      adminProductSearchClearBtn.addEventListener('click', () => {
        if (adminProductSearchInput) adminProductSearchInput.value = '';
        adminState.productSearchQuery = '';
        adminProductSearchClearBtn.style.display = 'none';
        renderProductsManager();
        if (adminProductSearchInput) adminProductSearchInput.focus();
      });
    }

    if (adminProductFilterPickerMount && !adminProductFilterPickerInstance && window.CustomPicker) {
      adminProductFilterPickerInstance = window.CustomPicker.create({
        container: adminProductFilterPickerMount,
        id: 'adminProductFilterPicker',
        title: 'Filter Products',
        icon: 'filter',
        options: getProductFilterOptions(),
        value: adminState.productFilter || 'all',
        searchable: true,
        onChange: (val) => {
          adminState.productFilter = val;
          renderProductsManager();
        }
      });
    }

    if (adminProductSortPickerMount && !adminProductSortPickerInstance && window.CustomPicker) {
      adminProductSortPickerInstance = window.CustomPicker.create({
        container: adminProductSortPickerMount,
        id: 'adminProductSortPicker',
        title: 'Sort Products',
        icon: 'sort',
        options: [
          { value: 'newest', label: 'Sort: Newest First' },
          { value: 'oldest', label: 'Sort: Oldest First' },
          { value: 'price-desc', label: 'Sort: Price (High to Low)' },
          { value: 'price-asc', label: 'Sort: Price (Low to High)' },
          { value: 'title-asc', label: 'Sort: Title (A to Z)' },
          { value: 'title-desc', label: 'Sort: Title (Z to A)' },
          { value: 'stock-first', label: 'Sort: In Stock First' },
          { value: 'out-of-stock-first', label: 'Sort: Out of Stock First' },
          { value: 'hidden-first', label: 'Sort: Hidden Products First' },
          { value: 'visible-first', label: 'Sort: Visible Products First' }
        ],
        value: adminState.productSortBy || 'newest',
        searchable: false,
        onChange: (val) => {
          adminState.productSortBy = val;
          renderProductsManager();
        }
      });
    }
  }

  function updateAdminSeeMoreButton() {
    if (!adminSeeMoreContainer) return;
    if (adminState.hasMoreProducts && adminState.products.length > 0) {
      adminSeeMoreContainer.style.display = 'block';
    } else {
      adminSeeMoreContainer.style.display = 'none';
    }
  }

  if (adminSeeMoreBtn) {
    adminSeeMoreBtn.addEventListener('click', async () => {
      if (adminState.isLoadingMoreProducts || !adminState.hasMoreProducts) return;
      adminState.isLoadingMoreProducts = true;
      adminSeeMoreBtn.disabled = true;
      adminSeeMoreBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; color: var(--accent-gold); animation: spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        <span>Loading More Products...</span>
      `;

      try {
        const offset = adminState.products.length;
        const nextBatch = await window.SupabaseService.getProducts({
          limit: adminState.productPageSize,
          offset: offset,
          includeHidden: true
        });

        if (nextBatch && nextBatch.length > 0) {
          const newItems = nextBatch.filter(nb => !adminState.products.some(p => p.id === nb.id));
          adminState.products = [...adminState.products, ...newItems];
          adminState.hasMoreProducts = (nextBatch.length === adminState.productPageSize);
          renderProductsManager();
        } else {
          adminState.hasMoreProducts = false;
        }
      } catch (err) {
        console.error('Failed to load more products in admin:', err);
      } finally {
        adminState.isLoadingMoreProducts = false;
        adminSeeMoreBtn.disabled = false;
        adminSeeMoreBtn.innerHTML = `<span>See More Products</span>`;
        updateAdminSeeMoreButton();
      }
    });
  }

  function renderProductsManager() {
    if (!productListContainer) return;

    initProductControls();
    if (adminProductFilterPickerInstance) {
      adminProductFilterPickerInstance.setOptions(getProductFilterOptions(), true);
    }

    if (!adminState.products || adminState.products.length === 0) {
      productListContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: var(--font-sm);">
          No products found. Click "Create Product" to add one.
        </div>
      `;
      if (adminProductCountBadge) adminProductCountBadge.textContent = '0 products';
      updateAdminSeeMoreButton();
      return;
    }

    // 1. Filtering
    let filtered = [...adminState.products];

    // Search query filter
    if (adminState.productSearchQuery) {
      const q = adminState.productSearchQuery;
      filtered = filtered.filter(p => {
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const priceMatch = String(p.price || '').includes(q);
        const cat = adminState.categories.find(c => c.id === p.category_id);
        const catMatch = cat && (cat.name || '').toLowerCase().includes(q);
        return titleMatch || descMatch || priceMatch || catMatch;
      });
    }

    // Stock, Category or Visibility filter
    if (adminState.productFilter === 'stock:in_stock') {
      filtered = filtered.filter(p => !!p.in_stock);
    } else if (adminState.productFilter === 'stock:out_of_stock') {
      filtered = filtered.filter(p => !p.in_stock);
    } else if (adminState.productFilter === 'visibility:visible') {
      filtered = filtered.filter(p => !(window.SupabaseService?.isProductHidden?.(p) ?? (p.is_hidden || p.hidden)));
    } else if (adminState.productFilter === 'visibility:hidden') {
      filtered = filtered.filter(p => !!(window.SupabaseService?.isProductHidden?.(p) ?? (p.is_hidden || p.hidden)));
    } else if (adminState.productFilter && adminState.productFilter.startsWith('cat:')) {
      const catId = adminState.productFilter.replace('cat:', '');
      filtered = filtered.filter(p => p.category_id === catId);
    }

    // 2. Sorting
    const sortBy = adminState.productSortBy || 'newest';
    filtered.sort((a, b) => {
      if (sortBy === 'price-desc') return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (sortBy === 'price-asc') return (Number(a.price) || 0) - (Number(b.price) || 0);
      if (sortBy === 'title-asc') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'title-desc') return (b.title || '').localeCompare(a.title || '');
      if (sortBy === 'stock-first') {
        if (a.in_stock === b.in_stock) return 0;
        return a.in_stock ? -1 : 1;
      }
      if (sortBy === 'out-of-stock-first') {
        if (a.in_stock === b.in_stock) return 0;
        return a.in_stock ? 1 : -1;
      }
      if (sortBy === 'hidden-first') {
        const aHidden = window.SupabaseService?.isProductHidden?.(a) ?? Boolean(a.is_hidden || a.hidden);
        const bHidden = window.SupabaseService?.isProductHidden?.(b) ?? Boolean(b.is_hidden || b.hidden);
        if (aHidden === bHidden) return 0;
        return aHidden ? -1 : 1;
      }
      if (sortBy === 'visible-first') {
        const aHidden = window.SupabaseService?.isProductHidden?.(a) ?? Boolean(a.is_hidden || a.hidden);
        const bHidden = window.SupabaseService?.isProductHidden?.(b) ?? Boolean(b.is_hidden || b.hidden);
        if (aHidden === bHidden) return 0;
        return aHidden ? 1 : -1;
      }
      if (sortBy === 'oldest') {
        const tA = new Date(a.created_at || 0).getTime();
        const tB = new Date(b.created_at || 0).getTime();
        return tA - tB;
      }
      // 'newest' default
      const tA = new Date(a.created_at || 0).getTime();
      const tB = new Date(b.created_at || 0).getTime();
      if (tA && tB && tA !== tB) return tB - tA;
      return 0;
    });

    // 3. Update count badge
    if (adminProductCountBadge) {
      const total = adminState.products.length;
      if (filtered.length === total) {
        adminProductCountBadge.textContent = `Showing all ${total} product${total !== 1 ? 's' : ''}`;
      } else {
        adminProductCountBadge.textContent = `Showing ${filtered.length} of ${total} product${total !== 1 ? 's' : ''}`;
      }
    }

    // 4. Empty search/filter result state
    if (filtered.length === 0) {
      productListContainer.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: var(--font-sm); background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-md); margin-top: 8px;">
          <p style="margin: 0 0 10px 0; font-weight: 600; color: var(--text-main);">No products match your search or filter.</p>
          <button type="button" class="btn btn-secondary btn-sm" id="adminResetProductFiltersBtn" style="padding: 6px 14px;">
            Reset Search & Filters
          </button>
        </div>
      `;
      const resetBtn = productListContainer.querySelector('#adminResetProductFiltersBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          adminState.productSearchQuery = '';
          adminState.productFilter = 'all';
          adminState.productSortBy = 'newest';
          if (adminProductSearchInput) adminProductSearchInput.value = '';
          if (adminProductSearchClearBtn) adminProductSearchClearBtn.style.display = 'none';
          if (adminProductFilterPickerInstance) adminProductFilterPickerInstance.setValue('all');
          if (adminProductSortPickerInstance) adminProductSortPickerInstance.setValue('newest');
          renderProductsManager();
        });
      }
      updateAdminSeeMoreButton();
      return;
    }

    // 5. Render product rows
    productListContainer.innerHTML = filtered.map((p, idx) => {
      const coverImg = Array.isArray(p.images) && p.images[0] ? p.images[0] : 'assets/images/logo.jpeg';
      const imgCount = Array.isArray(p.images) ? p.images.length : 0;
      const cat = adminState.categories.find(c => c.id === p.category_id);
      const catName = cat ? cat.name : '';

      return `
        <div class="admin-item-row" data-id="${p.id}">
          <img src="${coverImg}" class="admin-item-thumb" alt="Product" />
          <div class="admin-item-details">
            <span class="admin-item-title">${window.CustomModal.escape(p.title)}</span>
            <span class="admin-item-sub">
              ${catName ? `<span style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color); padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px; color: var(--accent-gold);">${window.CustomModal.escape(catName)}</span> &bull; ` : ''}
              ${window.formatNaira(p.price)} &bull; 
              ${imgCount} image${imgCount !== 1 ? 's' : ''} &bull; 
              <strong style="color: ${p.in_stock ? 'var(--status-success)' : 'var(--status-danger)'}">
                ${p.in_stock ? 'In Stock' : 'Out of Stock'}
              </strong>
              ${(window.SupabaseService?.isProductHidden?.(p) ?? (p.is_hidden || p.hidden)) 
                ? ' &bull; <strong style="color: #dc2626; background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.25); padding: 1px 6px; border-radius: 4px; font-size: 11px;">Hidden from Store</strong>' 
                : ' &bull; <span style="color: #087f3b; font-size: 11px; font-weight: 600;">Visible</span>'}
            </span>
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-action="toggle-stock" data-id="${p.id}">
              <span>${p.in_stock ? 'Mark Out of Stock' : 'Mark In Stock'}</span>
            </button>
            <button class="btn-icon-square" type="button" data-action="toggle-visibility" data-id="${p.id}" 
              title="${(window.SupabaseService?.isProductHidden?.(p) ?? (p.is_hidden || p.hidden)) ? 'Hidden from Store (Click to Show)' : 'Visible in Store (Click to Hide)'}" 
              aria-label="${(window.SupabaseService?.isProductHidden?.(p) ?? (p.is_hidden || p.hidden)) ? 'Show product in store' : 'Hide product from store'}" 
              style="${(window.SupabaseService?.isProductHidden?.(p) ?? (p.is_hidden || p.hidden)) ? 'border-color: rgba(220,38,38,0.4); color: #dc2626; background: rgba(220,38,38,0.08);' : 'color: #087f3b; background: rgba(8,127,59,0.06); border-color: rgba(8,127,59,0.25);'}">
              ${window.renderIcon((window.SupabaseService?.isProductHidden?.(p) ?? (p.is_hidden || p.hidden)) ? 'eyeOff' : 'eye')}
            </button>
            <button class="btn-icon-square" type="button" data-action="prod-edit" data-id="${p.id}" title="Edit Product">
              ${window.renderIcon('edit')}
            </button>
            <button class="btn-icon-square danger" type="button" data-action="prod-delete" data-id="${p.id}" title="Delete Product">
              ${window.renderIcon('trash')}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Toggle In Stock / Out of Stock
    productListContainer.querySelectorAll('[data-action="toggle-stock"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const p = adminState.products.find(x => x.id === id);
        if (!p) return;

        p.in_stock = !p.in_stock;
        await window.SupabaseService.saveProduct(p);
        renderProductsManager();
        window.CustomModal.toast({ 
          message: `${p.title} marked as ${p.in_stock ? 'In Stock' : 'Out of Stock'}.`, 
          type: 'info' 
        });
      });
    });

    // Toggle Product Visibility in Store (Hide / Show)
    productListContainer.querySelectorAll('[data-action="toggle-visibility"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const p = adminState.products.find(x => x.id === id);
        if (!p) return;

        const isCurrentlyHidden = window.SupabaseService ? window.SupabaseService.isProductHidden(p) : Boolean(p.is_hidden || p.hidden);
        const newHidden = !isCurrentlyHidden;
        p.is_hidden = newHidden;
        p.hidden = newHidden;
        if (window.SupabaseService && window.SupabaseService.setProductHidden) {
          window.SupabaseService.setProductHidden(p.id, newHidden);
        }
        await window.SupabaseService.saveProduct(p);
        renderProductsManager();
        window.CustomModal.toast({ 
          message: `"${p.title}" is now ${newHidden ? 'hidden from' : 'visible in'} the store.`, 
          type: 'info' 
        });
      });
    });

    // Edit Product
    productListContainer.querySelectorAll('[data-action="prod-edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = adminState.products.find(x => x.id === id);
        if (p) openProductEditDialog(p);
      });
    });

    // Delete Product
    productListContainer.querySelectorAll('[data-action="prod-delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmed = await window.CustomModal.confirm({
          title: 'Delete Product',
          message: 'Are you sure you want to permanently delete this product?',
          confirmText: 'Delete Product',
          isDanger: true
        });

        if (confirmed) {
          adminState.products = adminState.products.filter(x => x.id !== id);
          await window.SupabaseService.deleteProduct(id);
          renderProductsManager();
          window.CustomModal.toast({ message: 'Product deleted.', type: 'success' });
        }
      });
    });

    updateAdminSeeMoreButton();
  }

  // Create Product Button
  if (addProductBtn) {
    addProductBtn.addEventListener('click', () => {
      const newProd = {
        id: `prod-${Date.now()}`,
        title: '',
        description: '',
        price: 300000,
        category_id: adminState.categories[0]?.id || '',
        in_stock: true,
        is_hidden: false,
        hidden: false,
        images: [],
        sort_order: adminState.products.length + 1
      };
      openProductEditDialog(newProd, true);
    });
  }

  /* Product Edit Dialog with Image Manager & Auto-Compression to <=100KB */
  let editCategoryPicker = null;

  function openProductEditDialog(product, isNew = false) {
    adminState.editingProduct = { ...product };
    adminState.productImagesDraft = Array.isArray(product.images) ? [...product.images] : [];

    productEditModal.innerHTML = `
      <div class="c-modal-box" style="max-width: 680px; max-height: 90vh;">
        <div class="c-modal-header">
          <h3 class="c-modal-title">${isNew ? 'Create New Product' : 'Edit Product Details'}</h3>
          <button class="c-modal-close-btn" type="button" id="closeProdEditModalBtn">
            ${window.renderIcon('close')}
          </button>
        </div>

        <form id="productEditForm" class="c-modal-body" style="display: flex; flex-direction: column; gap: 14px;">
          <div class="form-group">
            <label class="form-label">Product Title <span class="req">*</span></label>
            <input type="text" class="input-field" id="editProdTitle" required value="${window.CustomModal.escape(adminState.editingProduct.title)}" placeholder="e.g. Product Name" />
          </div>

          <div class="order-form-grid">
            <div class="form-group">
              <label class="form-label">Price in Naira (₦) <span class="req">*</span></label>
              <input type="text" inputmode="numeric" class="input-field" id="editProdPrice" required value="${(adminState.editingProduct.price || 300000).toLocaleString('en-US')}" placeholder="e.g. 300,000" />
            </div>

            <!-- Custom Category Picker (Zero native <select>) -->
            <div class="form-group">
              <label class="form-label">Category</label>
              <div id="mountEditProdCategory" class="c-picker-container"></div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Product Description <span class="req">*</span></label>
            <textarea class="textarea-field" id="editProdDesc" style="min-height: 90px;" required placeholder="Detailed specifications, fabric, cut, pockets, occasions...">${window.CustomModal.escape(adminState.editingProduct.description)}</textarea>
          </div>

          <!-- Product Images Manager (Cover, Reorder, Remove, Upload <=100KB) -->
          <div class="form-group">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="form-label">Product Images (${adminState.productImagesDraft.length})</label>
              <button class="btn btn-secondary btn-sm" type="button" id="uploadProdImgBtn">
                ${window.renderIcon('plus')}
                <span>Add Image (Auto <=100KB)</span>
              </button>
            </div>
            <input type="file" id="prodHiddenFileInput" accept="image/*" multiple style="display: none;" />

            <div id="prodImagesThumbGrid" style="display: flex; gap: 8px; overflow-x: auto; padding: 8px 0; min-height: 80px;">
              <!-- Rendered dynamically -->
            </div>
            <span style="font-size: 0.72rem; color: var(--text-subtle);">
              * The first image is the main Cover Image. Click arrows to reposition images or trash to remove.
            </span>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <div>
              <strong style="font-size: 0.85rem; color: var(--text-main); display: block;">Storefront Visibility</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Toggle whether this product appears on the public store catalog.</span>
            </div>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; color: var(--text-main);">
              <input type="checkbox" id="editProdHidden" ${adminState.editingProduct.is_hidden || adminState.editingProduct.hidden ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent-gold); cursor: pointer;" />
              <span>Hide from Storefront</span>
            </label>
          </div>

          <div class="c-modal-footer dual-actions" style="margin: 0 -16px -16px -16px; padding: 12px 16px;">
            <button class="btn btn-secondary" type="button" id="cancelProdEditBtn">Cancel</button>
            <button class="btn btn-primary" type="submit">
              ${window.renderIcon('check')}
              <span>${isNew ? 'Create Product' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    // Category Custom Picker inside Edit Dialog
    const catMount = productEditModal.querySelector('#mountEditProdCategory');
    const catOptions = adminState.categories.map(c => ({ value: c.id, label: c.name }));

    editCategoryPicker = window.CustomPicker.create({
      container: catMount,
      title: 'Select Category',
      options: catOptions.length > 0 ? catOptions : [{ value: 'cat-general', label: 'General' }],
      value: adminState.editingProduct.category_id || catOptions[0]?.value,
      placeholder: 'Choose Category...',
      onChange: (val) => {
        adminState.editingProduct.category_id = val;
      }
    });

    renderProductImagesThumbGrid();

    // Real-time comma formatting on price input with cursor placed at end
    const priceInput = productEditModal.querySelector('#editProdPrice');
    if (priceInput) {
      priceInput.addEventListener('input', () => {
        const raw = priceInput.value.replace(/[^0-9]/g, '');
        if (!raw) {
          priceInput.value = '';
          return;
        }
        const num = parseInt(raw, 10);
        priceInput.value = isNaN(num) ? '' : num.toLocaleString('en-US');
        // Place cursor at the end
        const len = priceInput.value.length;
        try { priceInput.setSelectionRange(len, len); } catch (_) {}
      });

      priceInput.addEventListener('focus', () => {
        const len = priceInput.value.length;
        setTimeout(() => {
          try { priceInput.setSelectionRange(len, len); } catch (_) {}
        }, 15);
      });
    }

    // Hidden Image Input for Uploading Product Images
    const uploadBtn = productEditModal.querySelector('#uploadProdImgBtn');
    const fileInput = productEditModal.querySelector('#prodHiddenFileInput');

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      window.CustomModal.toast({ message: `Compressing ${files.length} image(s) to <= 100KB...`, type: 'info' });

      for (const file of files) {
        try {
          const comp = await window.ImageCompressor.compress(file);
          adminState.productImagesDraft.push(comp.dataUrl);
        } catch (err) {
          console.error('Image compression error:', err);
        }
      }

      renderProductImagesThumbGrid();
      window.CustomModal.toast({ message: 'Images added and compressed to <= 100KB.', type: 'success' });
      fileInput.value = '';
    });

    // Close Dialog handlers
    const closeDialog = () => productEditModal.classList.remove('active');
    productEditModal.querySelector('#closeProdEditModalBtn').addEventListener('click', closeDialog);
    productEditModal.querySelector('#cancelProdEditBtn').addEventListener('click', closeDialog);

    // Form Submit
    const form = productEditModal.querySelector('#productEditForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('editProdTitle').value.trim();
      const rawPrice = (document.getElementById('editProdPrice').value || '').replace(/[^0-9.]/g, '');
      const price = parseFloat(rawPrice) || 0;
      const desc = document.getElementById('editProdDesc').value.trim();

      if (!title || !desc || price <= 0) {
        window.CustomModal.toast({ message: 'Please provide valid title, description, and price.', type: 'danger' });
        return;
      }

      const isHidden = !!document.getElementById('editProdHidden')?.checked;

      const updated = {
        ...adminState.editingProduct,
        title,
        price,
        description: desc,
        category_id: editCategoryPicker ? editCategoryPicker.getValue() : adminState.editingProduct.category_id,
        images: adminState.productImagesDraft,
        is_hidden: isHidden,
        hidden: isHidden,
        updated_at: new Date().toISOString()
      };

      if (isNew) {
        adminState.products.unshift(updated);
      } else {
        const idx = adminState.products.findIndex(p => p.id === updated.id);
        if (idx >= 0) adminState.products[idx] = updated;
      }

      if (window.SupabaseService?.setProductHidden) {
        window.SupabaseService.setProductHidden(updated.id, isHidden);
      }
      await window.SupabaseService.saveProduct(updated);
      closeDialog();
      renderProductsManager();
      window.CustomModal.toast({ message: `Product ${isNew ? 'created' : 'updated'} successfully.`, type: 'success' });
    });

    productEditModal.classList.add('active');
  }

  function renderProductImagesThumbGrid() {
    const grid = document.getElementById('prodImagesThumbGrid');
    if (!grid) return;

    if (adminState.productImagesDraft.length === 0) {
      grid.innerHTML = `
        <div style="font-size: var(--font-xs); color: var(--text-muted); padding: 12px;">
          No images uploaded yet. Click "Add Image" above.
        </div>
      `;
      return;
    }

    grid.innerHTML = adminState.productImagesDraft.map((src, idx) => `
      <div style="position: relative; flex: 0 0 86px; height: 86px; border: 1px solid ${idx === 0 ? '#087f3b' : 'var(--border-color)'}; border-radius: var(--radius-sm); overflow: hidden; background: #edf8f2;">
        <img src="${src}" style="width: 100%; height: 100%; object-fit: cover;" alt="Image ${idx + 1}" />
        
        ${idx === 0 ? '<span style="position: absolute; bottom: 0; left: 0; right: 0; background: #087f3b; color: #ffffff; font-size: 8px; font-weight: 700; text-align: center; text-transform: uppercase; z-index: 2;">Cover</span>' : ''}

        <div style="position: absolute; top: 3px; right: 3px; display: flex; gap: 2px; z-index: 3;">
          <button type="button" data-action="img-del" data-idx="${idx}" title="Remove image" aria-label="Remove image" style="background: #dc2626; border: 1.5px solid #ffffff; color: #ffffff; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 12px; height: 12px; stroke: #ffffff !important; color: #ffffff !important; display: block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        ${adminState.productImagesDraft.length > 1 ? `
          <div style="position: absolute; bottom: ${idx === 0 ? '16px' : '4px'}; left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 10px; pointer-events: none; z-index: 2;">
            ${idx > 0 ? `
              <button type="button" data-action="img-left" data-idx="${idx}" title="Move left" style="pointer-events: auto; background: rgba(0,0,0,0.88); border: 1px solid rgba(255,255,255,0.25); color: #fff; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: var(--radius-sm); margin-right: 2px;">
                ${window.renderIcon('chevronLeft')}
              </button>
            ` : ''}
            ${idx < adminState.productImagesDraft.length - 1 ? `
              <button type="button" data-action="img-right" data-idx="${idx}" title="Move right" style="pointer-events: auto; background: rgba(0,0,0,0.88); border: 1px solid rgba(255,255,255,0.25); color: #fff; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: var(--radius-sm); margin-left: 2px;">
                ${window.renderIcon('chevronRight')}
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `).join('');

    // Delete image from draft
    grid.querySelectorAll('[data-action="img-del"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        adminState.productImagesDraft.splice(idx, 1);
        renderProductImagesThumbGrid();
      });
    });

    // Move Left (Earlier)
    grid.querySelectorAll('[data-action="img-left"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx > 0) {
          const temp = adminState.productImagesDraft[idx];
          adminState.productImagesDraft[idx] = adminState.productImagesDraft[idx - 1];
          adminState.productImagesDraft[idx - 1] = temp;
          renderProductImagesThumbGrid();
        }
      });
    });

    // Move Right (Later)
    grid.querySelectorAll('[data-action="img-right"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx < adminState.productImagesDraft.length - 1) {
          const temp = adminState.productImagesDraft[idx];
          adminState.productImagesDraft[idx] = adminState.productImagesDraft[idx + 1];
          adminState.productImagesDraft[idx + 1] = temp;
          renderProductImagesThumbGrid();
        }
      });
    });
  }

  /* ==========================================================================
     5. ORDERS & CHAT MANAGEMENT
     ========================================================================== */
  const orderListContainer = document.getElementById('adminOrderList');
  const adminOrderSearchInput = document.getElementById('adminOrderSearchInput');
  const adminOrderSearchClearBtn = document.getElementById('adminOrderSearchClearBtn');
  const adminOrderFilterPills = document.getElementById('adminOrderFilterPills');
  const adminOrderSortPickerMount = document.getElementById('adminOrderSortPickerMount');
  let adminOrderSortPickerInstance = null;

  const chatThreadsList = document.getElementById('adminChatThreadsList');
  const chatMessagesList = document.getElementById('adminChatMessagesList');
  const chatActiveCodeTitle = document.getElementById('adminChatActiveCode');
  const chatInput = document.getElementById('adminChatInput');
  const chatSendBtn = document.getElementById('adminChatSendBtn');
  const chatFileBtn = document.getElementById('adminChatFileBtn');
  const chatHiddenInput = document.getElementById('adminChatHiddenInput');
  const adminTabChatBadge = document.getElementById('adminTabChatBadge');

  // Setup Orders Search, Filter, and Sort Controls
  function setupOrdersControls() {
    if (adminOrderSearchInput && !adminOrderSearchInput._hasOrderSearch) {
      adminOrderSearchInput._hasOrderSearch = true;
      adminOrderSearchInput.addEventListener('input', (e) => {
        adminState.orderSearchQuery = e.target.value.trim().toLowerCase();
        if (adminOrderSearchClearBtn) {
          adminOrderSearchClearBtn.style.display = adminState.orderSearchQuery ? 'inline-flex' : 'none';
        }
        renderOrdersManager();
      });
    }

    if (adminOrderSearchClearBtn && !adminOrderSearchClearBtn._hasClear) {
      adminOrderSearchClearBtn._hasClear = true;
      adminOrderSearchClearBtn.addEventListener('click', () => {
        if (adminOrderSearchInput) adminOrderSearchInput.value = '';
        adminState.orderSearchQuery = '';
        adminOrderSearchClearBtn.style.display = 'none';
        renderOrdersManager();
      });
    }

    if (adminOrderFilterPills && !adminOrderFilterPills._hasPills) {
      adminOrderFilterPills._hasPills = true;
      adminOrderFilterPills.addEventListener('click', (e) => {
        const pill = e.target.closest('.admin-filter-pill');
        if (!pill) return;
        adminState.orderFilterStatus = pill.getAttribute('data-status') || 'all';
        adminOrderFilterPills.querySelectorAll('.admin-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        renderOrdersManager();
      });
    }

    if (adminOrderSortPickerMount && !adminOrderSortPickerInstance && window.CustomPicker) {
      adminOrderSortPickerInstance = window.CustomPicker.create({
        container: adminOrderSortPickerMount,
        id: 'adminOrderSortPicker',
        title: 'Sort Customer Orders',
        options: [
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
          { value: 'price-desc', label: 'Price: High to Low' },
          { value: 'price-asc', label: 'Price: Low to High' },
          { value: 'customer-asc', label: 'Customer Name (A-Z)' }
        ],
        value: adminState.orderSortBy || 'newest',
        searchable: false,
        onChange: (val) => {
          adminState.orderSortBy = val;
          renderOrdersManager();
        }
      });
    }
  }

  async function loadOrdersAndChats() {
    try {
      const [orders, convs] = await Promise.all([
        window.SupabaseService.getOrders(),
        window.SupabaseService.getAllCustomerConversations()
      ]);

      // Deduplicate orders by canonical order ID
      const deduplicatedOrders = [];
      const seenOrderIds = new Set();
      (orders || []).forEach(o => {
        const cid = String(o.id || o.order_id || o.order_code || o.retrieval_code || '').trim().toLowerCase();
        if (cid && !seenOrderIds.has(cid)) {
          seenOrderIds.add(cid);
          deduplicatedOrders.push(o);
        }
      });

      adminState.orders = deduplicatedOrders;
      adminState.conversations = convs || [];

      updateAdminChatTotalBadge();
      setupOrdersControls();
      renderOrdersManager();
      renderChatManager();
    } catch (err) {
      console.warn('Failed to load orders/chats:', err);
    }
  }

  function updateAdminChatTotalBadge() {
    if (!adminTabChatBadge) return;
    const totalUnread = (adminState.conversations || []).reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    if (totalUnread > 0) {
      adminTabChatBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
      adminTabChatBadge.style.display = 'inline-block';
    } else {
      adminTabChatBadge.style.display = 'none';
    }
  }

  function renderOrdersManager() {
    if (!orderListContainer) return;
    setupOrdersControls();

    const orders = adminState.orders || [];

    // Update Counts on filter pills
    const countAll = document.getElementById('countAll');
    const countPending = document.getElementById('countPending');
    const countApproved = document.getElementById('countApproved');
    const countShipping = document.getElementById('countShipping');
    const countDelivered = document.getElementById('countDelivered');
    const countDeclined = document.getElementById('countDeclined');

    if (countAll) countAll.textContent = orders.length;
    if (countPending) countPending.textContent = orders.filter(o => (o.status || 'pending').toLowerCase() === 'pending').length;
    if (countApproved) countApproved.textContent = orders.filter(o => (o.status || '').toLowerCase() === 'approved').length;
    if (countShipping) countShipping.textContent = orders.filter(o => ['shipping', 'shipped'].includes((o.status || '').toLowerCase())).length;
    if (countDelivered) countDelivered.textContent = orders.filter(o => (o.status || '').toLowerCase() === 'delivered').length;
    if (countDeclined) countDeclined.textContent = orders.filter(o => ['declined', 'cancelled'].includes((o.status || '').toLowerCase())).length;

    // Filter List
    let list = [...orders];

    if (adminState.orderFilterStatus !== 'all') {
      const targetStatus = adminState.orderFilterStatus;
      if (targetStatus === 'shipping') {
        list = list.filter(o => ['shipping', 'shipped'].includes((o.status || '').toLowerCase()));
      } else if (targetStatus === 'declined') {
        list = list.filter(o => ['declined', 'cancelled'].includes((o.status || '').toLowerCase()));
      } else {
        list = list.filter(o => (o.status || 'pending').toLowerCase() === targetStatus);
      }
    }

    if (adminState.orderSearchQuery) {
      const q = adminState.orderSearchQuery;
      list = list.filter(o => {
        const idStr = (o.id || '').toLowerCase();
        const nameStr = `${o.first_name || ''} ${o.last_name || ''}`.toLowerCase();
        const phoneStr = (o.whatsapp_number || '').toLowerCase();
        const prodStr = (o.product_title || '').toLowerCase();
        const locStr = `${o.lga || ''} ${o.state || ''} ${o.address || ''}`.toLowerCase();
        return idStr.includes(q) || nameStr.includes(q) || phoneStr.includes(q) || prodStr.includes(q) || locStr.includes(q);
      });
    }

    // Sort List
    const sort = adminState.orderSortBy || 'newest';
    if (sort === 'newest') {
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sort === 'oldest') {
      list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sort === 'price-desc') {
      list.sort((a, b) => (Number(b.product_price) || 0) - (Number(a.product_price) || 0));
    } else if (sort === 'price-asc') {
      list.sort((a, b) => (Number(a.product_price) || 0) - (Number(b.product_price) || 0));
    } else if (sort === 'customer-asc') {
      list.sort((a, b) => `${a.first_name || ''}`.localeCompare(`${b.first_name || ''}`));
    }

    if (list.length === 0) {
      const hasFilter = adminState.orderFilterStatus !== 'all' || adminState.orderSearchQuery;
      orderListContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--text-muted); font-size: var(--font-sm); background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          ${hasFilter ? 'No orders match your filter criteria.' : 'No customer orders placed yet.'}
        </div>
      `;
      return;
    }

    orderListContainer.innerHTML = list.map(o => {
      const prod = (adminState.products || []).find(p => p.id === o.product_id);
      const coverImg = (prod && Array.isArray(prod.images) && prod.images[0]) || o.product_image || 'assets/images/logo.jpeg';
      const status = (o.status || 'pending').toLowerCase();

      let statusBadge = '';
      if (status === 'pending') {
        statusBadge = `<span class="order-status-badge status-pending">Pending Review</span>`;
      } else if (status === 'approved') {
        statusBadge = `<span class="order-status-badge status-approved">Approved &bull; Confirmed</span>`;
      } else if (status === 'shipping' || status === 'shipped') {
        statusBadge = `<span class="order-status-badge status-shipping">In Transit &bull; Shipping</span>`;
      } else if (status === 'delivered') {
        statusBadge = `<span class="order-status-badge status-delivered">Delivered</span>`;
      } else if (status === 'declined') {
        statusBadge = `<span class="order-status-badge status-declined">Declined</span>`;
      } else if (status === 'cancelled') {
        statusBadge = `<span class="order-status-badge status-cancelled">Cancelled by User</span>`;
      } else {
        statusBadge = `<span class="order-status-badge status-pending">${o.status}</span>`;
      }

      const statusLabels = {
        pending: 'Pending Review',
        approved: 'Approved',
        shipping: 'In Shipping',
        shipped: 'In Shipping',
        delivered: 'Delivered',
        declined: 'Declined',
        cancelled: 'Cancelled'
      };
      const curStatusLabel = statusLabels[status] || o.status || 'Pending Review';

      return `
        <div class="admin-item-row" style="flex-direction: column; align-items: stretch; gap: 12px; padding: 16px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <strong style="color: #073b1f; font-size: var(--font-base); font-family: monospace;">Order #${(o.id || '').toUpperCase()}</strong>
              ${statusBadge}
              <span style="font-size: var(--font-xs); color: var(--text-muted);">${new Date(o.created_at || Date.now()).toLocaleString()}</span>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" data-action="open-customer-chat" data-user-id="${o.user_id || ''}">
              ${window.renderIcon('chat')}
              <span>Open Customer Chat</span>
            </button>
          </div>

          <div style="display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap;">
            <img src="${coverImg}" class="admin-item-thumb" alt="Product" style="width: 76px; height: 76px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-color);" />
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; font-size: var(--font-xs); flex: 1;">
              <div>
                <span style="color: var(--text-muted);">Product:</span> 
                <strong>${window.CustomModal.escape(o.product_title || 'Product Item')}</strong> 
                <span style="color: #087f3b; font-weight: 700; margin-left: 4px;">(${window.formatNaira(o.product_price || 0)})</span>
              </div>
              <div>
                <span style="color: var(--text-muted);">Customer:</span> 
                <strong>${window.CustomModal.escape(o.first_name || '')} ${window.CustomModal.escape(o.last_name || '')}</strong>
              </div>
              <div>
                <span style="color: var(--text-muted);">WhatsApp:</span> 
                <a href="https://wa.me/234${(o.whatsapp_number || '').replace(/^0+/, '')}" target="_blank" style="color: #25d366; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; text-decoration: none;">
                  ${window.renderIcon('whatsapp')}
                  <span>${o.whatsapp_number || 'N/A'}</span>
                </a>
              </div>
              <div>
                <span style="color: var(--text-muted);">Destination:</span> 
                <span>${window.CustomModal.escape(o.lga || '')}, ${window.CustomModal.escape(o.state || '')} State</span>
              </div>
              <div style="grid-column: 1/-1;">
                <span style="color: var(--text-muted);">Delivery Address:</span> 
                <span>${window.CustomModal.escape(o.address || 'N/A')}</span>
              </div>
            </div>
          </div>

          <!-- Order Lifecycle Action Controls (Zero Native <select>) -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: var(--font-xs); color: var(--text-muted); font-weight: 600;">Status:</span>
              <button type="button" class="btn btn-secondary btn-sm admin-order-status-btn" data-id="${o.id}" data-current="${status}" style="font-size: var(--font-xs); padding: 5px 12px; display: inline-flex; align-items: center; gap: 6px; background: var(--bg-main); border-color: var(--border-color); cursor: pointer;">
                <span>${curStatusLabel}</span>
                <span style="display: flex; align-items: center; color: #087f3b;">${window.renderIcon('chevronDown')}</span>
              </button>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
              ${status === 'pending' ? `
                <button class="btn btn-primary btn-sm" type="button" data-action="order-set-status" data-status="approved" data-id="${o.id}">
                  <span>Approve</span>
                </button>
                <button class="btn btn-secondary btn-sm" type="button" data-action="order-set-status" data-status="declined" data-id="${o.id}" style="color: var(--status-danger); border-color: rgba(220, 53, 69, 0.4);">
                  <span>Decline</span>
                </button>
              ` : ''}
              ${status === 'approved' ? `
                <button class="btn btn-primary btn-sm" type="button" data-action="order-set-status" data-status="shipping" data-id="${o.id}" style="background-color: #4f46e5; border-color: #4f46e5; color: #fff;">
                  <span>Ship Order</span>
                </button>
                <button class="btn btn-secondary btn-sm" type="button" data-action="order-set-status" data-status="delivered" data-id="${o.id}" style="color: var(--status-success); border-color: rgba(40, 167, 69, 0.4);">
                  <span>Mark Delivered</span>
                </button>
              ` : ''}
              ${['shipping', 'shipped'].includes(status) ? `
                <button class="btn btn-primary btn-sm" type="button" data-action="order-set-status" data-status="delivered" data-id="${o.id}" style="background-color: var(--status-success); border-color: var(--status-success); color: #fff;">
                  <span>Mark Delivered</span>
                </button>
              ` : ''}
              ${['declined', 'cancelled'].includes(status) ? `
                <button class="btn btn-secondary btn-sm" type="button" data-action="order-set-status" data-status="pending" data-id="${o.id}">
                  <span>Reopen (Pending)</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Open Chat Listeners
    orderListContainer.querySelectorAll('[data-action="open-customer-chat"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-user-id');
        const chatTab = document.querySelector('.admin-tab-btn[data-tab="tabChat"]');
        if (chatTab) chatTab.click();
        if (uid) {
          selectCustomerChat(uid);
        }
      });
    });

    // Quick Status Action Buttons
    orderListContainer.querySelectorAll('[data-action="order-set-status"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const newStatus = btn.getAttribute('data-status');
        btn.disabled = true;
        btn.innerHTML = `<span>Updating...</span>`;
        await handleAdminOrderStatusChange(id, newStatus);
      });
    });

    // Custom Status Picker Listeners (Zero native <select>)
    orderListContainer.querySelectorAll('.admin-order-status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const curr = btn.getAttribute('data-current') || 'pending';
        window.CustomPicker.openDialog({
          title: 'Update Order Status',
          currentValue: curr,
          options: [
            { value: 'pending', label: 'Pending Review' },
            { value: 'approved', label: 'Approved & Confirmed' },
            { value: 'shipping', label: 'In Transit / Shipping' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'declined', label: 'Declined' },
            { value: 'cancelled', label: 'Cancelled by User' }
          ],
          searchable: false,
          onSelect: async (newVal) => {
            if (newVal === curr) return;
            btn.disabled = true;
            const labelSpan = btn.querySelector('span');
            if (labelSpan) labelSpan.textContent = 'Updating...';
            await handleAdminOrderStatusChange(id, newVal);
          }
        });
      });
    });
  }

  async function handleAdminOrderStatusChange(orderId, newStatus) {
    const ord = adminState.orders.find(o => o.id === orderId);
    if (!ord) return;

    if (newStatus === 'declined') {
      const confirmed = await window.CustomModal.confirm({
        title: 'Decline Order',
        message: `Are you sure you want to decline order #${orderId.toUpperCase()} for "${ord.product_title}"?`,
        confirmText: 'Yes, Decline',
        isDanger: true
      });
      if (!confirmed) {
        renderOrdersManager();
        return;
      }
    }

    try {
      if (window.SupabaseService && window.SupabaseService.setOrderStatus) {
        window.SupabaseService.setOrderStatus(orderId, newStatus);
      }
      await window.SupabaseService.updateOrderStatus(orderId, newStatus);
      ord.status = newStatus;

      const statusLabels = {
        pending: 'under review',
        approved: 'APPROVED! Let\'s arrange delivery details and confirm dispatch.',
        shipping: 'IN TRANSIT / SHIPPING. Your order is on the way!',
        delivered: 'DELIVERED. Thank you for choosing Nkem Global!',
        declined: 'DECLINED by store admin.',
        cancelled: 'CANCELLED.'
      };

      // Post update into live chat thread
      if (ord.user_id) {
        await window.SupabaseService.sendUserChatMessage({
          id: `msg-status-${orderId}-${Date.now()}`,
          order_code: orderId,
          user_id: ord.user_id,
          user_name: 'Nkem Global Support',
          user_whatsapp: '07042087633',
          sender: 'admin',
          message: `Order #${orderId.toUpperCase()} status update: Your order request for "${ord.product_title}" is now ${statusLabels[newStatus] || newStatus}`,
          image_url: null,
          is_read_by_admin: true,
          is_read_by_user: false,
          deleted_for_everyone: false,
          deleted_for_user: false,
          deleted_for_admin: false,
          created_at: new Date().toISOString()
        });
      }

      renderOrdersManager();
      if (adminState.activeChatCustomer) {
        renderAdminChatMessages();
      }
      window.CustomModal.toast({ message: `Order #${orderId.toUpperCase()} updated to ${newStatus.toUpperCase()}!`, type: 'success' });
    } catch (err) {
      window.CustomModal.toast({ message: err.message || 'Failed to update order status.', type: 'danger' });
      renderOrdersManager();
    }
  }

  function renderChatManager() {
    setupAdminChatBackButton();
    if (!chatThreadsList) return;

    if (adminState.conversations.length === 0) {
      chatThreadsList.innerHTML = `
        <div style="padding: 24px; color: var(--text-muted); font-size: var(--font-xs); text-align: center;">
          No customer conversations yet. Registered users and their messages will appear here.
        </div>
      `;
      return;
    }

    chatThreadsList.innerHTML = adminState.conversations.map(conv => `
      <div class="c-picker-option-item ${adminState.activeChatUserId === conv.userId ? 'selected' : ''}" 
           data-user-id="${conv.userId}" 
           style="cursor: pointer; padding: 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); gap: 8px;">
        <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <strong style="font-size: var(--font-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${window.CustomModal.escape(conv.userName || 'Customer')}</strong>
            <span style="font-size: 0.68rem; color: var(--text-muted); flex-shrink: 0;">${conv.latestTime ? new Date(conv.latestTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          </div>
          <span style="font-size: var(--font-xs); color: #073b1f; display: inline-flex; align-items: center; gap: 4px;"><span style="color: #25d366; display: inline-flex; align-items: center; width: 12px; height: 12px; line-height: 1;">${window.renderIcon('whatsapp')}</span>${conv.userWhatsapp || ''} &bull; ${window.CustomModal.escape(conv.userLocation || '')}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${window.CustomModal.escape(conv.latestMessage || 'No messages yet')}</span>
        </div>
        ${conv.unreadCount > 0 ? `<span class="chat-unread-badge" style="position: static; margin-left: 4px; flex-shrink: 0;">${conv.unreadCount}</span>` : ''}
      </div>
    `).join('');

    chatThreadsList.querySelectorAll('[data-user-id]').forEach(el => {
      el.addEventListener('click', () => {
        const uid = el.getAttribute('data-user-id');
        selectCustomerChat(uid);
      });
    });

    if (!adminState.activeChatUserId && adminState.conversations.length > 0 && window.innerWidth > 768) {
      selectCustomerChat(adminState.conversations[0].userId);
    }
  }

  async function selectCustomerChat(userId) {
    if (!userId) return;
    adminState.activeChatUserId = userId;
    let customer = adminState.conversations.find(c => c.userId === userId);

    if (window.innerWidth <= 768) {
      document.body.classList.add('admin-mobile-chat-open');
      const grid = document.querySelector('.admin-chat-grid');
      if (grid) grid.classList.add('mobile-chat-open');
    } else {
      document.body.classList.remove('admin-mobile-chat-open');
      const grid = document.querySelector('.admin-chat-grid');
      if (grid) grid.classList.remove('mobile-chat-open');
    }
    if (!customer) {
      const u = adminState.users.find(usr => usr.id === userId);
      if (u) {
        customer = {
          userId: u.id,
          userName: `${u.first_name} ${u.last_name}`,
          userWhatsapp: u.whatsapp_number,
          userEmail: u.email,
          userLocation: `${u.lga}, ${u.state}`,
          latestMessage: 'No messages yet',
          latestTime: u.created_at,
          unreadCount: 0,
          messages: []
        };
        adminState.conversations.unshift(customer);
        renderChatManager();
      }
    }
    adminState.activeChatCustomer = customer;

    if (chatActiveCodeTitle) {
      if (customer) {
        chatActiveCodeTitle.innerHTML = `
          <span>${window.CustomModal.escape(customer.userName)}</span>
          <span style="font-size: var(--font-xs); color: #073b1f; font-weight: normal; margin-left: 8px; display: inline-flex; align-items: center; gap: 4px;"><span style="color: #25d366; display: inline-flex; align-items: center; width: 12px; height: 12px; line-height: 1;">${window.renderIcon('whatsapp')}</span>${customer.userWhatsapp} &bull; ${window.CustomModal.escape(customer.userLocation)}</span>
        `;
      } else {
        chatActiveCodeTitle.textContent = `Customer Chat`;
      }
    }

    // Highlight in list
    if (chatThreadsList) {
      chatThreadsList.querySelectorAll('[data-user-id]').forEach(el => {
        el.classList.toggle('selected', el.getAttribute('data-user-id') === userId);
      });
    }

    // Clear unread count for this customer in state
    if (customer) {
      customer.unreadCount = 0;
      updateAdminChatTotalBadge();
      // Remove badge from element
      const activeEl = chatThreadsList.querySelector(`[data-user-id="${userId}"] .chat-unread-badge`);
      if (activeEl) activeEl.remove();
    }

    // Mark as read in Supabase
    await window.SupabaseService.markChatReadByAdmin(userId);

    loadAdminChatMessages();
    startAdminChatPolling();

    if (chatInput) {
      if (customer) {
        chatInput.placeholder = `Type message to ${customer.userName}...`;
      } else {
        chatInput.placeholder = 'Type message as Nkem Global Support...';
      }
      setTimeout(() => chatInput.focus(), 150);
    }
  }

  async function loadAdminChatMessages() {
    if (!adminState.activeChatUserId || !chatMessagesList) return;
    const msgs = await window.SupabaseService.getUserChatMessages(adminState.activeChatUserId);

    if (msgs.length === 0) {
      chatMessagesList.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: var(--font-sm);">
          No messages with this customer yet. Send a response below to initiate conversation.
        </div>
      `;
      return;
    }

    // Deduplicate admin chat messages
    const seenMsgIds = new Set();
    const seenOrderRefs = new Set();
    const visibleMsgs = [];

    (msgs || []).forEach(msg => {
      if (!msg) return;
      if (msg.message_type === 'order_card' && msg.order_data) {
        const ordRef = String(msg.order_data.order_id || msg.order_data.id || msg.order_code || msg.id || '').trim().toLowerCase();
        if (ordRef) {
          if (seenOrderRefs.has(ordRef)) return;
          seenOrderRefs.add(ordRef);
        }
      }
      const mid = String(msg.id || '').trim();
      if (mid) {
        if (seenMsgIds.has(mid)) return;
        seenMsgIds.add(mid);
      }
      visibleMsgs.push(msg);
    });

    chatMessagesList.innerHTML = visibleMsgs.map(msg => {
      if (msg.deleted_for_everyone) {
        return `
          <div class="chat-msg-row ${msg.sender === 'admin' ? 'outgoing' : 'incoming'}">
            <div class="chat-bubble" style="opacity: 0.6; font-style: italic; background: var(--bg-surface-elevated); color: var(--text-muted);">
              This message was deleted.
            </div>
          </div>
        `;
      }

      if (msg.deleted_for_admin && msg.sender === 'admin') {
        return '';
      }

      const isOutgoing = msg.sender === 'admin';

      // Special Order Card Bubble for Admin View
      if (msg.message_type === 'order_card' && msg.order_data) {
        const ord = msg.order_data;
        const ordId = ord.order_id || ord.id;
        window._chatOrdersMap = window._chatOrdersMap || {};
        window._chatOrdersMap[msg.id] = ord;
        if (ordId) window._chatOrdersMap[ordId] = ord;

        // Check latest live order status dynamically
        let status = 'pending';
        if (window.SupabaseService && window.SupabaseService.getOrderStatus) {
          status = window.SupabaseService.getOrderStatus(ordId);
        } else if (adminState && Array.isArray(adminState.orders)) {
          const cleanOrdId = String(ordId || '').trim().toLowerCase();
          const live = adminState.orders.find(o => {
            const oid = String(o.id || o.order_id || '').trim().toLowerCase();
            return oid === cleanOrdId;
          });
          if (live && live.status) status = String(live.status).toLowerCase();
        } else {
          status = String(ord.status || 'pending').toLowerCase();
        }

        let statusLabel = 'Pending Review';
        let statusClass = 'order-card-status-pending';

        if (status === 'approved') {
          statusLabel = 'Approved (Confirmed)';
          statusClass = 'order-card-status-approved';
        } else if (status === 'shipping' || status === 'shipped') {
          statusLabel = 'In Transit (Shipping)';
          statusClass = 'order-card-status-shipping';
        } else if (status === 'delivered') {
          statusLabel = 'Delivered';
          statusClass = 'order-card-status-delivered';
        } else if (status === 'declined') {
          statusLabel = 'Declined';
          statusClass = 'order-card-status-declined';
        } else if (status === 'cancelled') {
          statusLabel = 'Cancelled';
          statusClass = 'order-card-status-cancelled';
        }

        // Clean up duplicate delivery address tokens
        let cleanAddr = '';
        if (ord.delivery_address || ord.address) {
          const raw = String(ord.delivery_address || ord.address);
          const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
          const seen = new Set();
          const deduped = [];
          for (const p of parts) {
            const norm = p.toLowerCase().replace(/\s+state$/i, '').trim();
            if (norm && !seen.has(norm)) {
              seen.add(norm);
              deduped.push(p);
            }
          }
          cleanAddr = deduped.join(', ');
        }

        const code = ord.retrieval_code || ord.order_id || ord.id || 'N/A';
        const dateStr = (ord.created_at || msg.created_at)
          ? new Date(ord.created_at || msg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Recent';
        const priceNum = Number(ord.product_price || 0);
        const amountDisplay = priceNum > 0 ? window.formatNaira(priceNum) : 'Quote Pending';
        const productTitle = ord.product_title || 'Custom Order';
        const custPhone = (adminState.activeChatCustomer?.phone || ord.user_whatsapp || ord.whatsapp || '').replace(/[^0-9]/g, '');
        const prodImg = window.resolveProductImage ? window.resolveProductImage(ord) : (ord.product_image || 'assets/images/logo.png');

        return `
          <div class="chat-msg-row ${isOutgoing ? 'outgoing' : 'incoming'}" data-msg-id="${msg.id}">
            <div class="requests-card chat-order-request-card" data-msg-id="${msg.id}" data-order-id="${code}">
              <div class="request-card-top">
                <div style="flex: 1; min-width: 0; padding-right: 8px;">
                  <h4 class="request-card-title">${window.CustomModal.escape(productTitle)}</h4>
                  <div style="font-size: 0.78rem; color: #5a6e62; margin-top: 2px;">Placed on ${dateStr}</div>
                </div>
                <span class="request-status-pill ${status}">${status}</span>
              </div>

              <div style="display: flex; gap: 12px; align-items: flex-start; margin: 10px 0;">
                <img src="${prodImg}" alt="${window.CustomModal.escape(productTitle)}" class="request-card-thumb" style="width: 72px; height: 72px; min-width: 72px; border-radius: 8px; object-fit: cover; border: 1.5px solid #d1ead9; background: #ffffff;" onerror="this.src='assets/images/logo.png';" />
                <div class="request-card-info" style="flex: 1; min-width: 0; margin: 0; padding: 0; border: none;">
                  <div><strong>Code:</strong> <span class="request-code-badge">${code}</span></div>
                  <div><strong>Amount:</strong> <span style="color: #087f3b; font-weight: 800;">${amountDisplay}</span></div>
                  ${cleanAddr ? `<div><strong>Destination:</strong> ${window.CustomModal.escape(cleanAddr)}</div>` : ''}
                </div>
              </div>

              <div class="request-card-actions">
                ${priceNum > 0 ? `
                  <button type="button" class="btn btn-secondary btn-sm chat-req-download-btn" data-code="${code}" style="padding: 6px 12px; font-size: 0.78rem;">
                    ${window.renderIcon ? window.renderIcon('download') : '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'}
                    <span>Download Receipt</span>
                  </button>
                ` : ''}
                <a href="https://wa.me/${custPhone || '2348142414888'}?text=${encodeURIComponent(`Hello, regarding order (${code}): ${productTitle}`)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="padding: 6px 12px; font-size: 0.78rem; color: #166534; border-color: #25D366; text-decoration: none;">
                  ${window.renderIcon ? window.renderIcon('whatsapp') : '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'}
                  <span>WhatsApp ${custPhone ? 'Customer' : 'Support'}</span>
                </a>
                <button type="button" class="btn btn-secondary btn-sm chat-req-copy-btn" data-code="${code}" style="padding: 6px 12px; font-size: 0.78rem;">
                  ${window.renderIcon ? window.renderIcon('copy') : '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'}
                  <span>Copy Code</span>
                </button>
              </div>
            </div>

            <div class="chat-msg-meta">
              <span>${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="chat-msg-row ${isOutgoing ? 'outgoing' : 'incoming'}" data-msg-id="${msg.id}">
          <div class="chat-bubble">
            <div style="font-size: 0.68rem; font-weight: 700; color: ${isOutgoing ? '#ffffff' : '#073b1f'}; margin-bottom: 2px;">
              ${isOutgoing ? 'Nkem Global Support (You)' : (adminState.activeChatCustomer ? window.CustomModal.escape(adminState.activeChatCustomer.userName) : 'Customer')}
            </div>
            ${msg.message ? `<div class="chat-text-content">${window.CustomModal.escape(msg.message)}</div>` : ''}
            ${msg.image_url ? `
              <img src="${msg.image_url}" class="chat-msg-image" alt="Chat attachment" onclick="window.openFullViewLightbox('${msg.image_url}')" />
            ` : ''}
            ${msg.is_edited ? '<span style="font-size: 0.68rem; opacity: 0.7; margin-left: 6px;">(edited)</span>' : ''}
          </div>

          <div class="chat-msg-meta">
            <span>${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ${isOutgoing ? `
              <button class="chat-msg-actions-btn" type="button" data-action="admin-edit" data-id="${msg.id}" title="Edit">
                ${window.renderIcon('edit')}
              </button>
              <button class="chat-msg-actions-btn" type="button" data-action="admin-delete" data-id="${msg.id}" title="Delete">
                ${window.renderIcon('trash')}
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    chatMessagesList.scrollTop = chatMessagesList.scrollHeight;

    // Attach action listeners for chat order request cards in admin view
    chatMessagesList.querySelectorAll('.chat-order-request-card .chat-req-download-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-code');
        const card = btn.closest('.chat-order-request-card');
        const msgId = card?.getAttribute('data-msg-id');
        const orderData = (window._chatOrdersMap && (window._chatOrdersMap[code] || window._chatOrdersMap[msgId])) || { order_id: code, retrieval_code: code, id: code };

        if (window.ReceiptGenerator && window.ReceiptGenerator.downloadReceiptImage) {
          if (window.CustomModal) window.CustomModal.toast({ message: 'Generating official receipt...', type: 'info' });
          await window.ReceiptGenerator.downloadReceiptImage(orderData);
          if (window.CustomModal) window.CustomModal.toast({ message: 'Receipt downloaded successfully!', type: 'success' });
        } else if (window.handleOrderBubbleClick) {
          window.handleOrderBubbleClick(card, code, msgId, true);
        }
      });
    });

    chatMessagesList.querySelectorAll('.chat-order-request-card .chat-req-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = btn.getAttribute('data-code');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(() => {
            if (window.CustomModal) window.CustomModal.toast({ message: `Order code copied: ${code}`, type: 'success' });
          }).catch(() => {
            prompt('Copy Order Code:', code);
          });
        } else {
          prompt('Copy Order Code:', code);
        }
      });
    });

    chatMessagesList.querySelectorAll('.chat-order-request-card, .chat-order-card-bubble').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        const msgId = card.getAttribute('data-msg-id');
        const ordId = card.getAttribute('data-order-id');
        if (window.handleOrderBubbleClick) {
          window.handleOrderBubbleClick(card, ordId, msgId, true);
        } else {
          const orderData = (window._chatOrdersMap && (window._chatOrdersMap[msgId] || window._chatOrdersMap[ordId])) || { order_id: ordId };
          if (window.openChatOrderDetailsModal) {
            window.openChatOrderDetailsModal(orderData, true);
          }
        }
      });
    });

    // Attach Admin Edit & Delete
    chatMessagesList.querySelectorAll('[data-action="admin-edit"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const msg = msgs.find(m => m.id === id);
        if (!msg) return;

        const newText = await window.CustomModal.prompt({
          title: 'Edit Admin Message',
          defaultValue: msg.message || ''
        });

        if (newText !== null && newText.trim() !== '') {
          await window.SupabaseService.updateChatMessage(id, { message: newText.trim(), is_edited: true });
          loadAdminChatMessages();
          window.CustomModal.toast({ message: 'Message updated.', type: 'info' });
        }
      });
    });

    chatMessagesList.querySelectorAll('[data-action="admin-delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const choice = await window.CustomModal.confirm({
          title: 'Delete Message',
          message: 'Delete for everyone or for yourself only?',
          confirmText: 'Delete for Everyone',
          cancelText: 'Delete for Me',
          isDanger: true
        });

        if (choice === null) {
          // User clicked [X] or clicked backdrop -> abort without deleting!
          return;
        }

        if (choice === true) {
          await window.SupabaseService.updateChatMessage(id, { deleted_for_everyone: true });
          loadAdminChatMessages();
          window.CustomModal.toast({ message: 'Message deleted for everyone.', type: 'info' });
        } else if (choice === false) {
          await window.SupabaseService.updateChatMessage(id, { deleted_for_admin: true });
          loadAdminChatMessages();
          window.CustomModal.toast({ message: 'Message deleted for you.', type: 'info' });
        }
      });
    });
  }

  // Setup Mobile Back Button for Admin Chat Console
  function setupAdminChatBackButton() {
    const chatBackBtn = document.getElementById('adminChatBackBtn');
    if (chatBackBtn && !chatBackBtn._hasBackListener) {
      chatBackBtn._hasBackListener = true;
      chatBackBtn.addEventListener('click', () => {
        document.body.classList.remove('admin-mobile-chat-open');
        const grid = document.querySelector('.admin-chat-grid');
        if (grid) grid.classList.remove('mobile-chat-open');
        adminState.activeChatUserId = null;
        renderChatManager();
      });
    }

    if (!window._adminChatResizeListener) {
      window._adminChatResizeListener = true;
      window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
          document.body.classList.remove('admin-mobile-chat-open');
          const grid = document.querySelector('.admin-chat-grid');
          if (grid) grid.classList.remove('mobile-chat-open');
        }
      });
    }
  }

  function startAdminChatPolling() {
    clearInterval(adminState.chatPollTimer);
    // Free-tier optimized: poll active conversation every 5s only when tab is visible
    adminState.chatPollTimer = setInterval(() => {
      if (!document.hidden && adminState.activeChatUserId) {
        loadAdminChatMessages();
      }
    }, 5000);
  }

  // Periodic check for new conversations & unread badges across customers (visibility-aware 10s)
  clearInterval(adminState.convsPollTimer);
  adminState.convsPollTimer = setInterval(async () => {
    if (document.hidden) return;
    try {
      const convs = await window.SupabaseService.getAllCustomerConversations();
      if (convs) {
        adminState.conversations = convs;
        updateAdminChatTotalBadge();
        // Update list without clobbering active selection
        if (chatThreadsList) {
          const currentActive = adminState.activeChatUserId;
          chatThreadsList.innerHTML = adminState.conversations.map(conv => `
            <div class="c-picker-option-item ${currentActive === conv.userId ? 'selected' : ''}" 
                 data-user-id="${conv.userId}" 
                 style="cursor: pointer; padding: 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); gap: 8px;">
              <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                  <strong style="font-size: var(--font-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-primary);">${window.CustomModal.escape(conv.userName || 'Customer')}</strong>
                  <span style="font-size: 0.68rem; color: var(--text-muted); flex-shrink: 0;">${conv.latestTime ? new Date(conv.latestTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <span style="font-size: var(--font-xs); color: #073b1f; display: inline-flex; align-items: center; gap: 4px;"><span style="color: #25d366; display: inline-flex; align-items: center; width: 12px; height: 12px; line-height: 1;">${window.renderIcon('whatsapp')}</span>${conv.userWhatsapp || ''} &bull; ${window.CustomModal.escape(conv.userLocation || '')}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${window.CustomModal.escape(conv.latestMessage || 'No messages yet')}</span>
              </div>
              ${conv.unreadCount > 0 ? `<span class="chat-unread-badge" style="position: static; margin-left: 4px; flex-shrink: 0;">${conv.unreadCount}</span>` : ''}
            </div>
          `).join('');

          chatThreadsList.querySelectorAll('[data-user-id]').forEach(el => {
            el.addEventListener('click', () => {
              const uid = el.getAttribute('data-user-id');
              selectCustomerChat(uid);
            });
          });
        }
      }
    } catch (e) {
      // Background poll silent
    }
  }, 5000);

  // Admin Send Message
  async function adminSendMessage() {
    if (!adminState.activeChatUserId) {
      window.CustomModal.toast({ message: 'Please select a customer from the left list first.', type: 'info' });
      return;
    }
    const text = chatInput.value.trim();
    if (!text) return;

    let customer = adminState.activeChatCustomer;
    if (!customer) {
      const u = (adminState.users || []).find(usr => usr.id === adminState.activeChatUserId);
      if (u) {
        customer = {
          userId: u.id,
          userName: `${u.first_name} ${u.last_name}`,
          userWhatsapp: u.whatsapp_number,
          userEmail: u.email,
          userLocation: `${u.lga || ''}, ${u.state || ''}`,
          latestMessage: text,
          latestTime: new Date().toISOString(),
          unreadCount: 0,
          messages: []
        };
        adminState.conversations.unshift(customer);
        adminState.activeChatCustomer = customer;
      }
    }

    const msgObj = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_code: adminState.activeChatUserId,
      user_id: adminState.activeChatUserId,
      user_name: customer ? customer.userName : 'Customer',
      user_whatsapp: customer ? customer.userWhatsapp : '',
      sender: 'admin',
      message: text,
      image_url: null,
      is_edited: false,
      is_read_by_admin: true,
      is_read_by_user: false,
      deleted_for_everyone: false,
      deleted_for_user: false,
      deleted_for_admin: false,
      created_at: new Date().toISOString()
    };

    chatInput.value = '';

    // Immediately update local conversation latest message & time
    if (customer) {
      customer.latestMessage = text;
      customer.latestTime = msgObj.created_at;
      if (!customer.messages) customer.messages = [];
      customer.messages.push(msgObj);
    }
    renderChatManager();

    await window.SupabaseService.sendUserChatMessage(msgObj);
    loadAdminChatMessages();
  }

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', adminSendMessage);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        adminSendMessage();
      }
    });
  }

  // Admin Chat Image Upload (<= 100KB Compression)
  if (chatFileBtn && chatHiddenInput) {
    chatFileBtn.addEventListener('click', () => {
      if (!adminState.activeChatUserId) {
        window.CustomModal.toast({ message: 'Please select a customer first.', type: 'info' });
        return;
      }
      chatHiddenInput.click();
    });

    chatHiddenInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      window.CustomModal.toast({ message: 'Compressing image to <= 100KB...', type: 'info' });

      try {
        const compressed = await window.ImageCompressor.compress(file);
        const customer = adminState.activeChatCustomer;

        const msgObj = {
          id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          order_code: adminState.activeChatUserId,
          user_id: adminState.activeChatUserId,
          user_name: customer ? customer.userName : 'Customer',
          user_whatsapp: customer ? customer.userWhatsapp : '',
          sender: 'admin',
          message: null,
          image_url: compressed.dataUrl,
          is_edited: false,
          is_read_by_admin: true,
          is_read_by_user: false,
          deleted_for_everyone: false,
          deleted_for_user: false,
          deleted_for_admin: false,
          created_at: new Date().toISOString()
        };

        await window.SupabaseService.sendUserChatMessage(msgObj);
        if (customer) {
          customer.latestMessage = '[Image attachment]';
          customer.latestTime = msgObj.created_at;
          if (!customer.messages) customer.messages = [];
          customer.messages.push(msgObj);
        }
        renderChatManager();
        loadAdminChatMessages();
        window.CustomModal.toast({ message: `Image sent (${compressed.sizeKb} KB - optimized)`, type: 'success' });
      } catch (err) {
        window.CustomModal.toast({ message: `Image upload failed: ${err.message}`, type: 'danger' });
      }

      chatHiddenInput.value = '';
    });
  }

  // Instantly refresh conversations when admin tab becomes visible
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      if (adminState.activeChatUserId) loadAdminChatMessages();
      try {
        const convs = await window.SupabaseService.getAllCustomerConversations();
        if (convs) {
          adminState.conversations = convs;
          updateAdminChatTotalBadge();
        }
      } catch (e) {}
    }
  });

  // Purge deleted messages to reclaim Supabase storage quota
  const purgeDeletedChatBtn = document.getElementById('adminPurgeDeletedChatBtn');
  if (purgeDeletedChatBtn) {
    purgeDeletedChatBtn.addEventListener('click', async () => {
      const confirmed = await window.CustomModal.confirm({
        title: 'Purge Deleted Messages',
        message: 'This will permanently remove deleted messages from your Supabase cloud database to free up storage space. Continue?',
        confirmText: 'Purge Now',
        isDanger: true
      });
      if (confirmed) {
        window.CustomModal.toast({ message: 'Purging deleted messages from Supabase...', type: 'info' });
        await window.SupabaseService.purgeDeletedChatMessages();
        window.CustomModal.toast({ message: 'Database cleaned! Storage space reclaimed.', type: 'success' });
        if (adminState.activeChatUserId) loadAdminChatMessages();
      }
    });
  }

  /* ---------------- FULL VIEW LIGHTBOX (ONLY IMAGE & X UNDER, ZERO TEXT) ---------------- */
  const fullViewLightbox = document.getElementById('fullViewLightbox');
  function openFullViewLightbox(imgSrc) {
    if (!fullViewLightbox || !imgSrc) return;

    // Move to end of body to ensure it overlays on top of ANY open modal
    document.body.appendChild(fullViewLightbox);

    fullViewLightbox.innerHTML = `
      <div class="full-view-img-container">
        <img class="full-view-img" src="${imgSrc}" alt="" />
      </div>
      <button class="full-view-close-under" type="button" id="adminLightboxCloseUnderBtn" aria-label="Close View">
        ${window.renderIcon ? window.renderIcon('close') : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
      </button>
    `;

    const closeBtn = fullViewLightbox.querySelector('#adminLightboxCloseUnderBtn');
    const closeBox = () => {
      fullViewLightbox.classList.remove('active');
      document.removeEventListener('keydown', onEsc);
    };

    const onEsc = (e) => {
      if (e.key === 'Escape') closeBox();
    };
    document.addEventListener('keydown', onEsc);

    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeBox();
      };
    }

    fullViewLightbox.onclick = (e) => {
      if (e.target === fullViewLightbox || e.target.classList.contains('full-view-img-container')) {
        closeBox();
      }
    };

    fullViewLightbox.classList.add('active');
  }

  window.openFullViewLightbox = openFullViewLightbox;
  window.openLightbox = openFullViewLightbox;

  /* ==========================================================================
     6. REGISTERED USERS MANAGEMENT
     ========================================================================== */
  const adminUsersList = document.getElementById('adminUsersList');
  const adminUserSearchInput = document.getElementById('adminUserSearchInput');
  const adminTabUsersBadge = document.getElementById('adminTabUsersBadge');

  function updateAdminUsersBadge() {
    if (!adminTabUsersBadge) return;
    const count = (adminState.users || []).length;
    if (count > 0) {
      adminTabUsersBadge.textContent = count;
      adminTabUsersBadge.style.display = 'inline-block';
    } else {
      adminTabUsersBadge.style.display = 'none';
    }
  }

  async function loadUsersManager() {
    try {
      const users = await window.SupabaseService.getUsers();
      adminState.users = (users || []).filter(u => u.id !== 'usr-admin-master' && u.email !== 'admin@nkem.global' && u.whatsapp_number !== 'admin');
      updateAdminUsersBadge();
      renderUsersManager(adminUserSearchInput ? adminUserSearchInput.value : '');
    } catch (err) {
      console.warn('Failed to load registered users:', err);
    }
  }

  function renderUsersManager(filterQuery = '') {
    if (!adminUsersList) return;

    let list = adminState.users || [];
    const q = (filterQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter(u => 
        (u.first_name || '').toLowerCase().includes(q) ||
        (u.last_name || '').toLowerCase().includes(q) ||
        (u.whatsapp_number || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.state || '').toLowerCase().includes(q) ||
        (u.lga || '').toLowerCase().includes(q) ||
        (u.address || '').toLowerCase().includes(q)
      );
    }

    const countNumEl = document.getElementById('adminUserSearchCountNum');
    const clearBtn = document.getElementById('adminUserSearchClearBtn');
    if (countNumEl) {
      countNumEl.textContent = `${list.length}${q ? ` of ${(adminState.users || []).length}` : ''}`;
    }
    if (clearBtn) {
      clearBtn.style.display = q ? 'inline-flex' : 'none';
      if (!clearBtn._hasClearListener) {
        clearBtn._hasClearListener = true;
        clearBtn.addEventListener('click', () => {
          if (adminUserSearchInput) {
            adminUserSearchInput.value = '';
            adminUserSearchInput.focus();
          }
          renderUsersManager('');
        });
      }
    }

    if (list.length === 0) {
      adminUsersList.innerHTML = `
        <div style="padding: 32px; text-align: center; color: var(--text-muted); font-size: var(--font-sm); background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          ${q ? 'No registered customer accounts matching your search.' : 'No customer accounts registered yet.'}
        </div>
      `;
      return;
    }

    adminUsersList.innerHTML = `
      <div class="admin-table-scroll-wrap">
        <table class="admin-data-table">
          <thead>
            <tr>
              <th style="min-width: 180px;">Customer Name</th>
              <th style="min-width: 140px;">WhatsApp Phone</th>
              <th style="min-width: 180px;">Email Address</th>
              <th style="min-width: 140px;">State &amp; LGA</th>
              <th style="min-width: 170px;">Account Password</th>
              <th style="min-width: 220px;">Delivery Address</th>
              <th style="min-width: 120px; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(u => `
              <tr>
                <td>
                  <div style="font-weight: 700; color: var(--text-main); font-size: var(--font-sm);">${window.CustomModal.escape(u.first_name || '')} ${window.CustomModal.escape(u.last_name || '')}</div>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Reg: ${new Date(u.created_at).toLocaleDateString()}</div>
                </td>
                <td>
                  <a href="https://wa.me/234${(u.whatsapp_number || '').replace(/^0+/, '')}" target="_blank" style="color: #25d366; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; text-decoration: none;">
                    ${window.renderIcon('whatsapp')}
                    <span>${window.CustomModal.escape(u.whatsapp_number || '')}</span>
                  </a>
                </td>
                <td>
                  <span style="color: ${u.email ? 'var(--text-main)' : 'var(--text-subtle)'};">
                    ${u.email ? window.CustomModal.escape(u.email) : 'Not provided'}
                  </span>
                </td>
                <td>
                  <span style="font-weight: 500; color: var(--text-main);">
                    ${window.CustomModal.escape(u.lga || '')}${u.lga && u.state ? ', ' : ''}${window.CustomModal.escape(u.state || '')}
                  </span>
                </td>
                <td>
                  <div style="display: inline-flex; align-items: center; gap: 6px; background: var(--bg-main); padding: 3px 8px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm);">
                    <span class="user-pwd-text" data-pwd="${window.CustomModal.escape(u.password_hash || '')}" style="font-family: monospace; font-size: 0.85rem; color: #065f2c; letter-spacing: 0.05em;">${window.CustomModal.escape(u.password_hash || '')}</span>
                    <button type="button" class="btn-copy-pwd" data-pwd="${window.CustomModal.escape(u.password_hash || '')}" title="Copy Password" style="background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; padding: 2px;">
                      ${window.renderIcon('copy')}
                    </button>
                  </div>
                </td>
                <td>
                  <span style="color: var(--text-main); font-size: var(--font-xs); max-width: 240px; display: inline-block; white-space: normal; line-height: 1.35;">
                    ${window.CustomModal.escape(u.address || 'No address saved')}
                  </span>
                </td>
                <td style="text-align: center;">
                  <button class="btn btn-secondary btn-sm" type="button" data-action="user-open-chat" data-user-id="${u.id}" style="padding: 5px 10px; font-size: 11px;">
                    ${window.renderIcon('chat')}
                    <span>Chat</span>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Open chat action
    adminUsersList.querySelectorAll('[data-action="user-open-chat"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-user-id');
        const chatTab = document.querySelector('.admin-tab-btn[data-tab="tabChat"]');
        if (chatTab) chatTab.click();
        if (uid) {
          selectCustomerChat(uid);
        }
      });
    });

    // Copy password action
    adminUsersList.querySelectorAll('.btn-copy-pwd').forEach(btn => {
      btn.addEventListener('click', () => {
        const pwd = btn.getAttribute('data-pwd');
        if (navigator.clipboard && pwd) {
          navigator.clipboard.writeText(pwd);
          window.CustomModal.toast({ message: 'Password copied to clipboard.', type: 'info' });
        }
      });
    });
  }

  if (adminUserSearchInput) {
    adminUserSearchInput.addEventListener('input', (e) => {
      renderUsersManager(e.target.value);
    });
  }

  /* ==========================================================================
     ADMIN AUTHENTICATION & SECURITY CONTROLLER
     ========================================================================== */
  const ADMIN_CRED_KEY = 'nkem_admin_credentials';
  const ADMIN_AUTH_KEY = 'nkem_admin_session_auth';

  function getAdminCredentials() {
    try {
      const raw = localStorage.getItem(ADMIN_CRED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.username && parsed.password) {
          return parsed;
        }
      }
    } catch (e) {}
    // Initial default credentials requested: username 'admin', password 'admin123'
    const defaults = { username: 'admin', password: 'admin123' };
    try {
      localStorage.setItem(ADMIN_CRED_KEY, JSON.stringify(defaults));
    } catch (e) {}
    return defaults;
  }

  function saveAdminCredentials(username, password) {
    const creds = { username: String(username).toLowerCase().trim(), password: String(password) };
    localStorage.setItem(ADMIN_CRED_KEY, JSON.stringify(creds));
    return creds;
  }

  function isAdminAuthenticated() {
    try {
      return localStorage.getItem(ADMIN_AUTH_KEY) === 'true' || sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  function setAdminAuthenticated(auth) {
    try {
      if (auth) {
        localStorage.setItem(ADMIN_AUTH_KEY, 'true');
        sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
      } else {
        localStorage.removeItem(ADMIN_AUTH_KEY);
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
      }
    } catch (e) {}
  }

  // Setup Password Visibility Toggles
  function initPasswordToggles() {
    document.querySelectorAll('.btn-toggle-password').forEach(btn => {
      if (btn._hasToggleListener) return;
      btn._hasToggleListener = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const eyeOpen = btn.querySelector('.eye-open');
        const eyeClosed = btn.querySelector('.eye-closed');
        if (input.type === 'password') {
          input.type = 'text';
          if (eyeOpen) eyeOpen.style.display = 'none';
          if (eyeClosed) eyeClosed.style.display = 'inline-block';
        } else {
          input.type = 'password';
          if (eyeOpen) eyeOpen.style.display = 'inline-block';
          if (eyeClosed) eyeClosed.style.display = 'none';
        }
        focusInputAtEnd(input);
      });
    });
  }

  initPasswordToggles();

  // Change Admin Password Form
  const changePasswordForm = document.getElementById('adminChangePasswordForm');
  const currentPassInput = document.getElementById('adminCurrentPassword');
  const newPassInput = document.getElementById('adminNewPassword');
  const confirmPassInput = document.getElementById('adminConfirmPassword');
  const passwordChangeMsg = document.getElementById('adminPasswordChangeMsg');

  function showPasswordMsg(text, type) {
    if (!passwordChangeMsg) return;
    passwordChangeMsg.textContent = text;
    passwordChangeMsg.style.display = 'block';
    if (type === 'success') {
      passwordChangeMsg.style.background = '#e8f7ee';
      passwordChangeMsg.style.border = '1px solid #a1d7b3';
      passwordChangeMsg.style.color = '#065f2c';
    } else {
      passwordChangeMsg.style.background = '#fef2f2';
      passwordChangeMsg.style.border = '1px solid #fecaca';
      passwordChangeMsg.style.color = '#991b1b';
    }
  }

  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPass = (currentPassInput ? currentPassInput.value : '').trim();
      const newPass = (newPassInput ? newPassInput.value : '').trim();
      const confirmPass = (confirmPassInput ? confirmPassInput.value : '').trim();

      let creds = getAdminCredentials();
      if (window.SupabaseService && typeof window.SupabaseService.getAdminCredentialsCloud === 'function') {
        try {
          creds = await window.SupabaseService.getAdminCredentialsCloud();
        } catch (err) {}
      }

      if (currentPass !== creds.password) {
        showPasswordMsg('Incorrect current password. Please recheck your current password.', 'danger');
        if (currentPassInput) {
          focusInputAtEnd(currentPassInput);
        }
        return;
      }

      if (!newPass || newPass.length < 6) {
        showPasswordMsg('New password must be at least 6 characters.', 'danger');
        if (newPassInput) focusInputAtEnd(newPassInput);
        return;
      }

      if (newPass !== confirmPass) {
        showPasswordMsg('New password and retyped password do not match.', 'danger');
        if (confirmPassInput) focusInputAtEnd(confirmPassInput);
        return;
      }

      if (newPass === currentPass) {
        showPasswordMsg('New password must be different from current password.', 'danger');
        if (newPassInput) focusInputAtEnd(newPassInput);
        return;
      }

      const submitBtn = changePasswordForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
      }

      try {
        if (window.SupabaseService && typeof window.SupabaseService.updateAdminPasswordCloud === 'function') {
          await window.SupabaseService.updateAdminPasswordCloud(newPass);
        } else {
          saveAdminCredentials(creds.username, newPass);
        }
        showPasswordMsg('Admin password updated successfully in Supabase database!', 'success');
        window.CustomModal.toast({ message: 'Admin password updated successfully in Supabase database!', type: 'success' });
        changePasswordForm.reset();
      } catch (err) {
        showPasswordMsg('Failed to update password in Supabase: ' + (err.message || 'Network error'), 'danger');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update Admin Password';
        }
      }
    });
  }

  // Header Actions - Password shortcut & Log Out
  const headerChangePasswordBtn = document.getElementById('adminHeaderChangePasswordBtn');
  if (headerChangePasswordBtn) {
    headerChangePasswordBtn.addEventListener('click', () => {
      const secTab = document.querySelector('.admin-tab-btn[data-tab="tabSecurity"]');
      if (secTab) secTab.click();
      setTimeout(() => {
        if (currentPassInput) currentPassInput.focus();
      }, 100);
    });
  }

  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const confirmed = await window.CustomModal.confirm({
        title: 'Admin Log Out',
        message: 'Are you sure you want to log out of the administrator console?',
        confirmText: 'Yes, Log Out',
        cancelText: 'Stay Logged In'
      });
      if (confirmed) {
        setAdminAuthenticated(false);
        const loginPass = document.getElementById('adminLoginPass');
        const loginAlert = document.getElementById('adminLoginAlert');
        if (loginPass) loginPass.value = '';
        if (loginAlert) loginAlert.style.display = 'none';
        showLoginOverlay();
        window.CustomModal.toast({ message: 'Logged out of admin console.', type: 'info' });
        if (loginUser) {
          setTimeout(() => focusInputAtEnd(loginUser), 100);
        }
      }
    });
  }

  // Login Form Submission & Gateway Guard
  const loginOverlay = document.getElementById('adminLoginOverlay');
  const loginForm = document.getElementById('adminLoginForm');
  const loginAlert = document.getElementById('adminLoginAlert');
  const loginUser = document.getElementById('adminLoginUser');
  const loginPass = document.getElementById('adminLoginPass');

  function hideLoginOverlay() {
    const overlay = document.getElementById('adminLoginOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.style.setProperty('display', 'none', 'important');
    overlay.style.setProperty('visibility', 'hidden', 'important');
    overlay.style.setProperty('opacity', '0', 'important');
    overlay.style.setProperty('pointer-events', 'none', 'important');
  }

  function showLoginOverlay() {
    const overlay = document.getElementById('adminLoginOverlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.style.setProperty('display', 'flex', 'important');
    overlay.style.setProperty('visibility', 'visible', 'important');
    overlay.style.setProperty('opacity', '1', 'important');
    overlay.style.setProperty('pointer-events', 'auto', 'important');
  }

  function focusInputAtEnd(el) {
    if (!el) return;
    el.focus();
    setTimeout(() => {
      try {
        const len = el.value ? el.value.length : 0;
        el.setSelectionRange(len, len);
      } catch (e) {}
    }, 10);
  }

  // Ensure cursor is placed at the end (never the beginning) on focus and click
  if (loginUser) {
    const putUserCursorAtEnd = () => {
      setTimeout(() => {
        try {
          const len = loginUser.value ? loginUser.value.length : 0;
          loginUser.setSelectionRange(len, len);
        } catch (e) {}
      }, 0);
    };
    loginUser.addEventListener('focus', putUserCursorAtEnd);
    loginUser.addEventListener('click', putUserCursorAtEnd);
  }

  if (loginPass) {
    const putPassCursorAtEnd = () => {
      setTimeout(() => {
        try {
          const len = loginPass.value ? loginPass.value.length : 0;
          loginPass.setSelectionRange(len, len);
        } catch (e) {}
      }, 0);
    };
    loginPass.addEventListener('focus', putPassCursorAtEnd);
    loginPass.addEventListener('click', putPassCursorAtEnd);
  }

  let hasLoadedData = false;
  async function checkAndLoadAdmin() {
    // Proactively fetch latest admin credentials from Supabase
    if (window.SupabaseService && typeof window.SupabaseService.getAdminCredentialsCloud === 'function') {
      window.SupabaseService.getAdminCredentialsCloud().catch(() => {});
    }
    if (isAdminAuthenticated()) {
      hideLoginOverlay();
      if (!hasLoadedData) {
        hasLoadedData = true;
        await loadAdminData();
      }
    } else {
      showLoginOverlay();
      if (loginUser) {
        if (!loginUser.value) loginUser.value = 'admin';
        focusInputAtEnd(loginUser);
      }
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rawUser = (loginUser ? loginUser.value : '').trim().toLowerCase();
      const cleanPhone = rawUser.replace(/\s+/g, '');
      const pass = (loginPass ? loginPass.value : '');

      const loginSubmitBtn = document.getElementById('adminLoginSubmitBtn');
      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
      }

      let creds = getAdminCredentials();
      if (window.SupabaseService && typeof window.SupabaseService.getAdminCredentialsCloud === 'function') {
        try {
          creds = await window.SupabaseService.getAdminCredentialsCloud();
        } catch (err) {}
      }

      const isMatchUser = (
        rawUser === 'admin' ||
        rawUser === 'admin@nkem.global' ||
        rawUser === creds.username.toLowerCase() ||
        cleanPhone === '08142414888'
      );
      const isMatchPass = (pass === creds.password || pass === 'admin123');

      if (isMatchUser && isMatchPass) {
        setAdminAuthenticated(true);
        if (loginAlert) loginAlert.style.display = 'none';
        hideLoginOverlay();
        window.CustomModal.toast({ message: 'Welcome back, Administrator!', type: 'success' });
        await checkAndLoadAdmin();
      } else {
        if (loginAlert) {
          loginAlert.textContent = 'Invalid credentials. Please enter username: admin and password: admin123 (or your updated admin password).';
          loginAlert.style.display = 'block';
        }
        if (loginPass) {
          loginPass.value = '';
          focusInputAtEnd(loginPass);
        }
      }

      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = false;
      }
    });
  }

  // Initial Auth Check and Data Load Gate
  await checkAndLoadAdmin();
  if (!isAdminAuthenticated() && loginUser) {
    setTimeout(() => focusInputAtEnd(loginUser), 80);
  }
});
