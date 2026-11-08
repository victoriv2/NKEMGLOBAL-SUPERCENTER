// Public Storefront Engine - Nkem Global
// Complete 5-Tab Architecture: Home ("Everything Dey" & 3-Col Categories), Shop (Catalog & Add to Cart),
// Requests (Tracking Orders & Sourcing Inquiries), Cart (Quantity Steppers, State/LGA Pickers, Checkout), Account (Profile, Live Chat, WhatsApp)

document.addEventListener('DOMContentLoaded', async () => {
  // App State
  const state = {
    currentTab: 'home',
    categories: [],
    products: [],
    filteredProducts: [],
    selectedCategory: 'all',
    selectedSort: 'newest',
    pageSize: 16, // STRICT 16-ROW CATALOG RULE
    hasMoreProducts: false,
    isLoadingMore: false,
    productCardTimers: {},
    currentView: localStorage.getItem('nkem_product_view') || 'grid',
    cart: []
  };

  // DOM Elements
  const productGrid = document.getElementById('productGrid');
  const seeMoreContainer = document.getElementById('seeMoreContainer');
  const seeMoreBtn = document.getElementById('seeMoreBtn');
  const categoryPickerMount = document.getElementById('categoryPickerMount');
  const sortPickerMount = document.getElementById('sortPickerMount');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');

  // Modals
  const detailsModalOverlay = document.getElementById('productDetailsModal');
  const fullViewLightbox = document.getElementById('fullViewLightbox');
  const customRequestModal = document.getElementById('customRequestModal');
  const orderSuccessModal = document.getElementById('orderSuccessModal');

  /* ==========================================================================
     1. CART ENGINE (Persisted in localStorage with Live Count Bubbles)
     ========================================================================== */
  function getCart() {
    try {
      const stored = localStorage.getItem('nkem_cart');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem('nkem_cart', JSON.stringify(cart));
    } catch (e) {}
    state.cart = cart;
    updateCartBadges();
  }

  function getCartCount() {
    const cart = getCart();
    return cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }

  function getCartTotal() {
    const cart = getCart();
    return cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  }

  function updateCartBadges() {
    const count = getCartCount();
    const bottomBadge = document.getElementById('bottomCartCount');
    const deskBadge = document.getElementById('deskCartBadge');

    [bottomBadge, deskBadge].forEach(b => {
      if (!b) return;
      if (count > 0) {
        b.textContent = count > 99 ? '99+' : count;
        b.style.display = 'flex';
      } else {
        b.style.display = 'none';
      }
    });
  }

  function addToCart(prod, quantity = 1) {
    if (!prod) return;
    const cart = getCart();
    const existing = cart.find(item => item.id === prod.id);
    const coverImg = Array.isArray(prod.images) && prod.images[0] ? prod.images[0] : 'assets/images/logo.png';

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({
        id: prod.id,
        title: prod.title,
        price: Number(prod.price) || 0,
        image: coverImg,
        category: prod.category || '',
        quantity: quantity
      });
    }

    saveCart(cart);

    window.CustomModal.toast({
      message: `Added "${prod.title}" to Cart!`,
      type: 'success'
    });

    if (state.currentTab === 'cart') {
      renderCartView();
    }
  }

  function removeFromCart(prodId) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== prodId);
    saveCart(cart);
    renderCartView();
    window.CustomModal.toast({ message: 'Item removed from cart.', type: 'info' });
  }

  function updateCartQuantity(prodId, delta) {
    const cart = getCart();
    const item = cart.find(i => i.id === prodId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      removeFromCart(prodId);
      return;
    }
    saveCart(cart);
    renderCartView();
  }

  function clearCart() {
    saveCart([]);
    renderCartView();
    window.CustomModal.toast({ message: 'Cart cleared.', type: 'info' });
  }

  /* ==========================================================================
     2. SPA TAB NAVIGATION (Home, Shop, Requests, Cart, Account)
     ========================================================================== */
  window.switchAppTab = function(tabName, categoryToFilter = null) {
    if (!tabName) tabName = 'home';
    state.currentTab = tabName;

    // Update bottom navigation bar
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update desktop navigation
    document.querySelectorAll('.desktop-nav-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Show active view container, hide others
    const views = {
      home: document.getElementById('viewHome'),
      shop: document.getElementById('viewShop'),
      requests: document.getElementById('viewRequests'),
      cart: document.getElementById('viewCart'),
      account: document.getElementById('viewAccount')
    };

    Object.keys(views).forEach(key => {
      const v = views[key];
      if (!v) return;
      if (key === tabName) {
        v.classList.add('active');
        v.style.display = 'block';
      } else {
        v.classList.remove('active');
        v.style.display = 'none';
      }
    });

    // Category filter override from Home Category Click
    if (categoryToFilter) {
      state.selectedCategory = categoryToFilter;
    }

    // Tab-specific rendering
    if (tabName === 'home') {
      renderHomeCategories();
    } else if (tabName === 'shop') {
      renderShopCategoryPills();
      applyFiltersAndSort();
    } else if (tabName === 'cart') {
      renderCartView();
    } else if (tabName === 'requests') {
      renderRequestsView();
    } else if (tabName === 'account') {
      renderAccountView();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      history.replaceState(null, '', '#' + tabName);
    } catch (e) {}
  };

  function initTabListeners() {
    // Bottom nav bar tabs
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab');
        window.switchAppTab(tab);
      });
    });

    // Desktop nav buttons
    document.querySelectorAll('.desktop-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab');
        window.switchAppTab(tab);
      });
    });
  }

  /* ==========================================================================
     3. INITIAL DATA FETCHING (Supabase with Local Preload)
     ========================================================================== */
  async function loadInitialData() {
    // 0ms INSTANT RENDER FROM LOCAL CACHE
    try {
      const cachedCategories = window.SupabaseService.getLocalCategories ? window.SupabaseService.getLocalCategories() : [];
      const cachedProducts = window.SupabaseService.getLocalProducts ? window.SupabaseService.getLocalProducts() : [];

      if (cachedCategories.length > 0) state.categories = cachedCategories;
      if (cachedProducts.length > 0) state.products = cachedProducts;

      renderHomeCategories();
      renderShopCategoryPills();
      initToolbars();
      initSeeMore();
      applyFiltersAndSort();
      updateCartBadges();
      checkUnreadMessages();
    } catch (e) {
      console.warn('Preload notice:', e);
    }

    // Fresh fetch from Supabase
    try {
      const [categories, products] = await Promise.all([
        window.SupabaseService.getCategories(),
        window.SupabaseService.getProducts({
          limit: state.pageSize,
          offset: 0,
          categoryId: state.selectedCategory,
          sort: state.selectedSort
        })
      ]);

      if (categories && categories.length > 0) state.categories = categories;
      if (products && products.length > 0) state.products = products;
      state.hasMoreProducts = Array.isArray(products) && products.length === state.pageSize;

      renderHomeCategories();
      renderShopCategoryPills();
      initToolbars();
      initSeeMore();
      applyFiltersAndSort();
      updateCartBadges();
      checkUnreadMessages();
    } catch (err) {
      console.warn('Supabase fetch notice (using cache):', err);
    }
  }

  /* ==========================================================================
     4. HOME VIEW: "EVERYTHING DEY" SOURCING REQUEST & 3-COL CATEGORIES
     ========================================================================== */
  function initHeroRequestForm() {
    const form = document.getElementById('heroRequestForm');
    const input = document.getElementById('heroRequestInput');
    if (!form || !input) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (!query) {
        window.CustomModal.toast({ message: 'Please type what you are looking for.', type: 'info' });
        input.focus();
        return;
      }
      openCustomSourcingRequestModal(query);
    });
  }

  function openCustomSourcingRequestModal(itemQuery) {
    if (!customRequestModal) return;
    const body = document.getElementById('customRequestModalBody');
    if (!body) return;

    const activeUser = window.SupabaseService.getActiveUser ? window.SupabaseService.getActiveUser() : {};

    body.innerHTML = `
      <div style="background: #e8f7ee; padding: 14px 16px; border-radius: 10px; border: 1.5px solid #d1ead9; margin-bottom: 16px;">
        <div style="font-size: 0.74rem; font-weight: 800; color: #087f3b; text-transform: uppercase; letter-spacing: 0.04em;">You Are Requesting:</div>
        <div style="font-size: 1.15rem; font-weight: 900; color: #064e26; margin-top: 3px;">${window.CustomModal.escape(itemQuery)}</div>
        <div style="font-size: 0.78rem; color: #5a6e62; margin-top: 4px;">Our procurement team will send you 2 best options with photos within 30 minutes!</div>
      </div>

      <form id="customSourcingForm" autocomplete="on">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <div class="c-input-group">
            <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">Your Name *</label>
            <input type="text" class="c-input" id="reqUserName" placeholder="First and Last name" required value="${window.CustomModal.escape(activeUser.name || '')}" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
          </div>
          <div class="c-input-group">
            <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">WhatsApp Number *</label>
            <input type="tel" class="c-input" id="reqUserWhatsApp" placeholder="e.g. 08012345678" required value="${window.CustomModal.escape(activeUser.whatsapp_number || activeUser.phone || '')}" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
          </div>
        </div>

        <div class="c-input-group" style="margin-bottom: 14px;">
          <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">Target Budget / Specific Details (Optional)</label>
          <input type="text" class="c-input" id="reqUserNotes" placeholder="e.g. Budget ₦250k, Brand new, Size 42, Black color" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
          <button type="submit" class="btn btn-primary" id="submitSourcingBtn" style="width: 100%; justify-content: center; padding: 12px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;">
            ${window.renderIcon('send')}
            <span>Submit Sourcing Request (Within 30 Mins)</span>
          </button>

          <a href="https://wa.me/2347042087633?text=${encodeURIComponent(`Hello Nkem Global, I am requesting: ${itemQuery}. Please send me 2 best options with pictures within 30 minutes!`)}" target="_blank" rel="noopener" class="btn btn-secondary" style="width: 100%; justify-content: center; padding: 11px; font-weight: 700; color: #166534; border-color: #25D366; text-decoration: none;">
            ${window.renderIcon('whatsapp')}
            <span>Send Directly on WhatsApp</span>
          </a>
        </div>
      </form>
    `;

    const closeBtn = customRequestModal.querySelector('#closeCustomRequestBtn');
    const closeModal = () => customRequestModal.classList.remove('active');
    if (closeBtn) closeBtn.onclick = closeModal;

    const form = body.querySelector('#customSourcingForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userName = body.querySelector('#reqUserName').value.trim();
      const userPhone = body.querySelector('#reqUserWhatsApp').value.trim();
      const userNotes = body.querySelector('#reqUserNotes').value.trim();

      if (!userName || !userPhone) {
        window.CustomModal.toast({ message: 'Please provide your name and WhatsApp number.', type: 'danger' });
        return;
      }

      const submitBtn = body.querySelector('#submitSourcingBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:6px;"></span>
        <span>Submitting Request...</span>
      `;

      const reqId = `req-${Date.now()}`;
      const code = `NKG-REQ-${Date.now()}`;
      const title = `Sourcing Request: ${itemQuery}${userNotes ? ` (${userNotes})` : ''}`;

      const orderData = {
        id: reqId,
        retrieval_code: code,
        user_id: activeUser.id || null,
        product_id: 'custom-sourcing',
        product_title: title,
        product_price: 0,
        product_image: 'assets/images/logo.png',
        first_name: userName.split(' ')[0] || userName,
        last_name: userName.split(' ')[1] || '',
        whatsapp_number: userPhone,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      try {
        await window.SupabaseService.createOrder(orderData);
      } catch (err) {}

      closeModal();
      window.CustomModal.toast({
        message: 'Request submitted! Our team will send 2 options within 30 mins.',
        type: 'success'
      });

      // Navigate to Requests tab
      window.switchAppTab('requests');
    });

    customRequestModal.classList.add('active');
  }

  function renderHomeCategories() {
    const grid = document.getElementById('homeCategoriesGrid');
    if (!grid) return;

    const categories = state.categories || [];
    if (categories.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #5a6e62;">Loading categories...</div>';
      return;
    }

    grid.innerHTML = categories.map(c => {
      const img = c.image_url || 'assets/images/logo.png';
      return `
        <div class="home-category-card" data-cat-name="${window.CustomModal.escape(c.name)}" role="button" tabindex="0">
          <div class="home-category-img-wrap">
            <img class="home-category-img" src="${img}" alt="${window.CustomModal.escape(c.name)}" loading="lazy" />
          </div>
          <span class="home-category-title">${window.CustomModal.escape(c.name)}</span>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.home-category-card').forEach(card => {
      const handleClick = () => {
        const catName = card.getAttribute('data-cat-name');
        window.switchAppTab('shop', catName);
      };
      card.addEventListener('click', handleClick);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      });
    });
  }

  /* ==========================================================================
     5. SHOP VIEW: CATEGORY PILLS, TOOLBAR, CATALOG & ADD TO CART
     ========================================================================== */
  function renderShopCategoryPills() {
    const bar = document.getElementById('shopCategoryPills');
    if (!bar) return;

    const categories = state.categories || [];
    const allPill = `
      <button type="button" class="shop-cat-pill ${state.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
        All Products
      </button>
    `;

    const catPills = categories.map(c => `
      <button type="button" class="shop-cat-pill ${state.selectedCategory === c.name || state.selectedCategory === c.id ? 'active' : ''}" data-cat="${window.CustomModal.escape(c.name)}">
        ${window.CustomModal.escape(c.name)}
      </button>
    `).join('');

    bar.innerHTML = allPill + catPills;

    bar.querySelectorAll('.shop-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat');
        state.selectedCategory = cat;
        bar.querySelectorAll('.shop-cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Sync with modular dropdown picker if available
        if (categoryPickerInstance) {
          categoryPickerInstance.setValue(cat);
        }

        applyFiltersAndSort();
      });
    });
  }

  let categoryPickerInstance = null;
  let sortPickerInstance = null;

  function initToolbars() {
    try {
      if (categoryPickerMount && window.CustomPicker) {
        const opts = [
          { value: 'all', label: 'All Categories' },
          ...(state.categories.map(c => ({ value: c.name, label: c.name })))
        ];

        if (!categoryPickerInstance) {
          categoryPickerInstance = window.CustomPicker.create({
            container: categoryPickerMount,
            title: 'Filter by Category',
            options: opts,
            value: state.selectedCategory,
            placeholder: 'All Categories',
            searchable: true,
            onChange: (val) => {
              state.selectedCategory = val;
              renderShopCategoryPills();
              applyFiltersAndSort();
            }
          });
        } else if (categoryPickerInstance.setOptions) {
          categoryPickerInstance.setOptions(opts, true);
        }
      }
    } catch (e) {
      console.warn('Category picker init notice:', e);
    }

    try {
      if (sortPickerMount && window.CustomPicker && !sortPickerInstance) {
        const sortOpts = [
          { value: 'newest', label: 'Newest Arrivals' },
          { value: 'price_asc', label: 'Price: Low to High' },
          { value: 'price_desc', label: 'Price: High to Low' }
        ];

        sortPickerInstance = window.CustomPicker.create({
          container: sortPickerMount,
          title: 'Sort Catalog By',
          options: sortOpts,
          value: state.selectedSort,
          placeholder: 'Sort By',
          searchable: false,
          onChange: (val) => {
            state.selectedSort = val;
            applyFiltersAndSort();
          }
        });
      }
    } catch (e) {
      console.warn('Sort picker init notice:', e);
    }

    // Search input listener
    try {
      const searchInput = document.getElementById('shopSearchInput');
      if (searchInput && !searchInput._hasListener) {
        searchInput._hasListener = true;
        searchInput.addEventListener('input', () => {
          applyFiltersAndSort();
        });
      }
    } catch (e) {}

    initViewToggle();
  }

  function applyProductView(view) {
    state.currentView = view || 'grid';
    try {
      localStorage.setItem('nkem_product_view', state.currentView);
    } catch (e) {}

    const pGrid = document.getElementById('productGrid');
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');

    if (pGrid) {
      if (state.currentView === 'list') {
        pGrid.classList.add('list-view');
      } else {
        pGrid.classList.remove('list-view');
      }
    }

    if (gridBtn && listBtn) {
      if (state.currentView === 'list') {
        gridBtn.classList.remove('active');
        listBtn.classList.add('active');
      } else {
        listBtn.classList.remove('active');
        gridBtn.classList.add('active');
      }
    }
  }
  window.switchProductView = applyProductView;

  function initViewToggle() {
    const gridBtn = document.getElementById('viewGridBtn');
    const listBtn = document.getElementById('viewListBtn');

    if (gridBtn) {
      gridBtn.onclick = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        applyProductView('grid');
      };
      gridBtn.addEventListener('click', (e) => {
        e.preventDefault();
        applyProductView('grid');
      });
    }
    if (listBtn) {
      listBtn.onclick = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        applyProductView('list');
      };
      listBtn.addEventListener('click', (e) => {
        e.preventDefault();
        applyProductView('list');
      });
    }
    applyProductView(state.currentView);
  }

  function applyFiltersAndSort() {
    let prods = [...state.products];

    // Filter by Category
    if (state.selectedCategory && state.selectedCategory !== 'all') {
      const rawTarget = String(state.selectedCategory).toLowerCase().trim();
      const targetCatObj = (state.categories || []).find(c => 
        (c.id && c.id.toLowerCase() === rawTarget) ||
        (c.name && c.name.toLowerCase() === rawTarget)
      );
      const targetId = targetCatObj ? targetCatObj.id.toLowerCase() : rawTarget;
      const targetName = targetCatObj ? targetCatObj.name.toLowerCase() : rawTarget;

      prods = prods.filter(p => {
        const prodCatId = String(p.category_id || '').toLowerCase().trim();
        const prodCatField = String(p.category || '').toLowerCase().trim();
        const prodCatNameField = String(p.category_name || '').toLowerCase().trim();

        // If product has category_id, resolve its category name from state.categories
        let resolvedCatName = '';
        if (prodCatId) {
          const match = (state.categories || []).find(c => c.id.toLowerCase() === prodCatId);
          if (match) resolvedCatName = match.name.toLowerCase();
        }

        const candidateValues = [prodCatId, prodCatField, prodCatNameField, resolvedCatName].filter(Boolean);
        if (candidateValues.length === 0) return false;

        return candidateValues.some(val => 
          val === targetId || 
          val === targetName ||
          (val.length >= 4 && targetName.includes(val)) ||
          (targetName.length >= 4 && val.includes(targetName))
        );
      });
    }

    // Filter by Search Query
    const searchInput = document.getElementById('shopSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (query) {
      prods = prods.filter(p => {
        const title = (p.title || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const cat = (p.category_name || p.category || p.category_id || '').toLowerCase();
        return title.includes(query) || desc.includes(query) || cat.includes(query);
      });
    }

    // Sort
    if (state.selectedSort === 'price_asc') {
      prods.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (state.selectedSort === 'price_desc') {
      prods.sort((a, b) => Number(b.price) - Number(a.price));
    } else {
      prods.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    state.filteredProducts = prods;
    renderProductGrid();
    updateSeeMoreButton();
  }

  function renderProductGrid() {
    if (!productGrid) return;

    // Ensure list-view class reflects state.currentView
    if (state.currentView === 'list') {
      productGrid.classList.add('list-view');
    } else {
      productGrid.classList.remove('list-view');
    }

    // Clear card image timers
    Object.values(state.productCardTimers).forEach(timer => clearInterval(timer));
    state.productCardTimers = {};

    if (state.filteredProducts.length === 0) {
      productGrid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #ffffff; border-radius: 14px; border: 1px solid #d1ead9;">
          <h4 style="color: #073b1f; font-size: 1.15rem; font-weight: 800; margin-bottom: 6px;">No matching products found</h4>
          <p style="color: #5a6e62; font-size: 0.88rem; margin-bottom: 14px;">Try selecting another category or typing another search keyword.</p>
          <button class="btn btn-primary" type="button" id="resetFiltersBtn" style="padding: 10px 20px;">
            <span>View All Products</span>
          </button>
        </div>
      `;

      productGrid.querySelector('#resetFiltersBtn')?.addEventListener('click', () => {
        state.selectedCategory = 'all';
        const searchInput = document.getElementById('shopSearchInput');
        if (searchInput) searchInput.value = '';
        renderShopCategoryPills();
        if (categoryPickerInstance) categoryPickerInstance.setValue('all');
        applyFiltersAndSort();
      });
      return;
    }

    productGrid.innerHTML = state.filteredProducts.map(prod => {
      const images = Array.isArray(prod.images) && prod.images.length > 0 
        ? prod.images 
        : ['assets/images/logo.png'];
      const hasMultipleImages = images.length > 1;

      return `
        <article class="product-card" data-prod-id="${prod.id}" tabindex="0">
          <div class="product-card-img-wrap" data-prod-id="${prod.id}">
            ${images.map((img, i) => `
              <img class="product-card-img-slide ${i === 0 ? 'active' : ''}" 
                   src="${img}" 
                   alt="${window.CustomModal.escape(prod.title)} View ${i + 1}" 
                   data-slide-idx="${i}" 
                   loading="lazy" />
            `).join('')}

            <span class="product-card-badge ${prod.in_stock ? 'in-stock' : 'out-of-stock'}">
              ${prod.in_stock ? 'In Stock' : 'Out of Stock'}
            </span>

            ${hasMultipleImages ? `
              <div class="product-card-dots">
                ${images.map((_, i) => `<span class="product-card-dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
              </div>
            ` : ''}
          </div>

          <div class="product-card-content">
            <h3 class="product-card-title">${window.CustomModal.escape(prod.title)}</h3>
            <p class="product-card-desc">${window.CustomModal.escape(prod.description)}</p>
            <div class="product-card-footer">
              <span class="product-card-price">${window.formatNaira(prod.price)}</span>
              <button class="btn btn-add-to-cart" type="button" data-id="${prod.id}" title="Add to Cart">
                ${window.renderIcon('cart')}
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Setup 2s auto-slide for each product card with multiple images
    state.filteredProducts.forEach(prod => {
      const images = Array.isArray(prod.images) ? prod.images : [];
      if (images.length > 1) {
        let currentIdx = 0;
        const wrap = productGrid.querySelector(`.product-card-img-wrap[data-prod-id="${prod.id}"]`);
        if (wrap) {
          const slides = wrap.querySelectorAll('.product-card-img-slide');
          const dots = wrap.querySelectorAll('.product-card-dot');

          state.productCardTimers[prod.id] = setInterval(() => {
            slides[currentIdx].classList.remove('active');
            if (dots[currentIdx]) dots[currentIdx].classList.remove('active');

            currentIdx = (currentIdx + 1) % slides.length;

            slides[currentIdx].classList.add('active');
            if (dots[currentIdx]) dots[currentIdx].classList.add('active');
          }, 2000);
        }
      }
    });

    // "Add to Cart" Button Clicks
    productGrid.querySelectorAll('.btn-add-to-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prodId = btn.getAttribute('data-id');
        const prod = state.filteredProducts.find(p => p.id === prodId) || state.products.find(p => p.id === prodId);
        if (prod) {
          addToCart(prod, 1);

          // Animate button state
          const originalHtml = btn.innerHTML;
          btn.innerHTML = `
            ${window.renderIcon('check')}
            <span>Added!</span>
          `;
          btn.style.backgroundColor = '#055c2a';

          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.style.backgroundColor = '';
          }, 1200);
        }
      });
    });

    // Card click opens details modal
    productGrid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-add-to-cart')) return;
        const prodId = card.getAttribute('data-prod-id');
        openProductDetailsModal(prodId);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const prodId = card.getAttribute('data-prod-id');
          openProductDetailsModal(prodId);
        }
      });
    });

    // Ensure list-view/grid-view class is accurately synced
    applyProductView(state.currentView);
  }

  function updateSeeMoreButton() {
    if (!seeMoreContainer) return;
    if (state.hasMoreProducts) {
      seeMoreContainer.style.display = 'block';
    } else {
      seeMoreContainer.style.display = 'none';
    }
  }

  function initSeeMore() {
    if (!seeMoreBtn) return;
    seeMoreBtn.addEventListener('click', async () => {
      if (state.isLoadingMore) return;
      state.isLoadingMore = true;
      seeMoreBtn.disabled = true;
      seeMoreBtn.innerHTML = `
        <span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #087f3b; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:6px;"></span>
        <span>Loading More Products...</span>
      `;

      try {
        const nextProducts = await window.SupabaseService.getProducts({
          limit: state.pageSize,
          offset: state.products.length,
          categoryId: state.selectedCategory,
          sort: state.selectedSort
        });

        if (Array.isArray(nextProducts) && nextProducts.length > 0) {
          state.products = [...state.products, ...nextProducts];
          state.hasMoreProducts = nextProducts.length === state.pageSize;
          applyFiltersAndSort();
        } else {
          state.hasMoreProducts = false;
          updateSeeMoreButton();
        }
      } catch (err) {
        console.error('See More notice:', err);
      } finally {
        state.isLoadingMore = false;
        seeMoreBtn.disabled = false;
        seeMoreBtn.innerHTML = `<span>See More Products</span>`;
      }
    });
  }

  /* ==========================================================================
     6. PRODUCT DETAILS MODAL & FULL VIEW LIGHTBOX
     ========================================================================== */
  let currentModalSelectedImage = '';

  function openProductDetailsModal(prodId) {
    const prod = state.products.find(p => p.id === prodId) || state.filteredProducts.find(p => p.id === prodId);
    if (!prod || !detailsModalOverlay) return;

    state.activeProductForOrder = prod;
    const images = Array.isArray(prod.images) && prod.images.length > 0 
      ? prod.images 
      : ['assets/images/logo.png'];
    currentModalSelectedImage = images[0];

    const modalContent = detailsModalOverlay.querySelector('.product-details-modal-box');
    modalContent.innerHTML = `
      <div class="c-modal-header">
        <h3 class="c-modal-title">Product Details</h3>
        <button class="c-modal-close-btn" type="button" id="closeDetailsModalBtn" aria-label="Close Product Details">
          ${window.renderIcon('close')}
        </button>
      </div>

      <div class="details-modal-content">
        <div class="details-gallery-wrap">
          <div class="details-main-img-box" id="detailsMainImgBox" title="Click to view full image" style="width: 100%; min-height: 280px; height: clamp(320px, 48vh, 440px); flex: 0 0 auto; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
            <img class="details-main-img" id="detailsMainImg" src="${currentModalSelectedImage}" alt="${window.CustomModal.escape(prod.title)}" style="width: 100%; height: 100%; max-height: 100%; object-fit: contain; display: block;" />
            <div class="details-img-zoom-hint">
              ${window.renderIcon('search')}
              <span>Tap for Full View</span>
            </div>
          </div>

          <!-- Slideable Sub Images Under Preview -->
          ${images.length > 1 ? `
            <div class="details-sub-images-wrap">
              <button class="details-thumb-nav-btn prev" type="button" id="thumbNavPrevBtn" aria-label="Previous image">
                ${window.renderIcon('chevronLeft')}
              </button>
              <div class="details-sub-images-track" id="detailsSubImagesTrack">
                ${images.map((src, idx) => `
                  <div class="details-sub-thumb ${idx === 0 ? 'active' : ''}" data-src="${src}" role="button" tabindex="0" aria-label="Thumbnail ${idx + 1}">
                    <img src="${src}" alt="Thumb ${idx + 1}" />
                  </div>
                `).join('')}
              </div>
              <button class="details-thumb-nav-btn next" type="button" id="thumbNavNextBtn" aria-label="Next image">
                ${window.renderIcon('chevronRight')}
              </button>
            </div>
          ` : ''}
        </div>

        <div class="details-info-wrap">
          <h2 class="details-product-title">${window.CustomModal.escape(prod.title)}</h2>

          <div class="details-badge-row">
            <span class="product-card-badge ${prod.in_stock ? 'in-stock' : 'out-of-stock'}">
              ${prod.in_stock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>

          <div class="details-product-price">${window.formatNaira(prod.price)}</div>

          <div class="details-desc-box">
            <span class="details-desc-heading">Product Description</span>
            <p class="details-desc-body">${window.CustomModal.escape(prod.description || 'No detailed description available.')}</p>
          </div>

          <div style="margin-top: auto; padding-top: 16px; display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center; padding: 12px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;" type="button" id="detailsAddToCartBtn" ${!prod.in_stock ? 'disabled' : ''}>
              ${window.renderIcon('cart')}
              <span>Add to Cart — ${window.formatNaira(prod.price)}</span>
            </button>

            <a href="https://wa.me/2347042087633?text=${encodeURIComponent(`Hello Nkem Global, I would like to order: ${prod.title} (${window.formatNaira(prod.price)}). Is this available?`)}" target="_blank" rel="noopener" class="btn btn-secondary" style="width: 100%; justify-content: center; padding: 11px; font-weight: 700; color: #166534; border-color: #25D366; text-decoration: none;">
              ${window.renderIcon('whatsapp')}
              <span>Order on WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    `;

    // Click sub-image to change main image
    const mainImg = modalContent.querySelector('#detailsMainImg');
    const thumbs = modalContent.querySelectorAll('.details-sub-thumb');
    const track = modalContent.querySelector('#detailsSubImagesTrack');
    const thumbPrevBtn = modalContent.querySelector('#thumbNavPrevBtn');
    const thumbNextBtn = modalContent.querySelector('#thumbNavNextBtn');

    thumbs.forEach(thumb => {
      const selectThumb = () => {
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        const src = thumb.getAttribute('data-src');
        currentModalSelectedImage = src;
        mainImg.src = src;
        thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      };
      thumb.addEventListener('click', selectThumb);
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectThumb();
        }
      });
    });

    // Arrow navigation for thumbnails
    if (track && thumbPrevBtn && thumbNextBtn) {
      thumbPrevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        track.scrollBy({ left: -140, behavior: 'smooth' });
      });
      thumbNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        track.scrollBy({ left: 140, behavior: 'smooth' });
      });
    }

    // Click main image -> Full View Lightbox (Only image & X under)
    modalContent.querySelector('#detailsMainImgBox')?.addEventListener('click', () => {
      openFullViewLightbox(currentModalSelectedImage);
    });

    // Add to Cart
    modalContent.querySelector('#detailsAddToCartBtn')?.addEventListener('click', () => {
      addToCart(prod, 1);
      detailsModalOverlay.classList.remove('active');
    });

    // Close Modal
    const closeModal = () => detailsModalOverlay.classList.remove('active');
    modalContent.querySelector('#closeDetailsModalBtn')?.addEventListener('click', closeModal);

    // Backdrop click close
    if (!detailsModalOverlay._hasBackdropListener) {
      detailsModalOverlay._hasBackdropListener = true;
      detailsModalOverlay.addEventListener('click', (e) => {
        if (e.target === detailsModalOverlay) {
          detailsModalOverlay.classList.remove('active');
        }
      });
    }

    detailsModalOverlay.classList.add('active');
  }

  /* ==========================================================================
     6. FULL VIEW LIGHTBOX (Strict Requirement: Only Image & X Under to Close, No Text)
     ========================================================================== */
  function openFullViewLightbox(imgSrc) {
    if (!fullViewLightbox || !imgSrc) return;

    fullViewLightbox.innerHTML = `
      <div class="full-view-img-container">
        <img class="full-view-img" src="${imgSrc}" alt="" />
      </div>
      <button class="full-view-close-under" type="button" id="fullViewCloseUnderBtn" aria-label="Close View">
        ${window.renderIcon('close')}
      </button>
    `;

    const closeBtn = fullViewLightbox.querySelector('#fullViewCloseUnderBtn');
    const closeLightbox = () => {
      fullViewLightbox.classList.remove('active');
      document.removeEventListener('keydown', onEsc);
    };

    const onEsc = (e) => {
      if (e.key === 'Escape') closeLightbox();
    };
    document.addEventListener('keydown', onEsc);

    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeLightbox();
      };
    }

    fullViewLightbox.onclick = (e) => {
      if (e.target === fullViewLightbox || e.target.classList.contains('full-view-img-container')) {
        closeLightbox();
      }
    };

    fullViewLightbox.classList.add('active');
  }

  /* ==========================================================================
     7. CART VIEW (Items, Totals, Delivery Info & Protected Checkout)
     ========================================================================== */
  function renderCartView() {
    const container = document.getElementById('cartContentContainer');
    const clearBtn = document.getElementById('cartClearBtn');
    if (!container) return;

    const cart = getCart();
    if (cart.length === 0) {
      if (clearBtn) clearBtn.style.display = 'none';
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">${window.renderIcon('cart')}</div>
          <h3 class="cart-empty-title">Your Shopping Cart is Empty</h3>
          <p class="cart-empty-sub">Explore our catalog and add the items you need to your cart.</p>
          <button class="btn btn-primary" type="button" id="cartStartShoppingBtn" style="padding: 12px 28px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;">
            ${window.renderIcon('shop')}
            <span>Start Shopping Now</span>
          </button>
        </div>
      `;
      container.querySelector('#cartStartShoppingBtn')?.addEventListener('click', () => {
        window.switchAppTab('shop');
      });
      return;
    }

    if (clearBtn) clearBtn.style.display = 'block';

    const subtotal = getCartTotal();
    const activeUser = (window.SupabaseService.getCurrentUser && window.SupabaseService.getCurrentUser()) || 
                       (window.SupabaseService.getActiveUser && window.SupabaseService.getActiveUser()) || {};
    const isLoggedIn = !!(activeUser && activeUser.id);

    container.innerHTML = `
      <div class="cart-items-list" id="cartItemsList">
        ${cart.map(item => `
          <div class="cart-item-card" data-item-id="${item.id}">
            <img src="${item.image || 'assets/images/logo.png'}" alt="${window.CustomModal.escape(item.title)}" class="cart-item-thumb" />
            <div class="cart-item-info">
              <h4 class="cart-item-title">${window.CustomModal.escape(item.title)}</h4>
              <div class="cart-item-unit-price">${window.formatNaira(item.price)} each</div>
              <div style="font-size: 0.78rem; color: #5a6e62; margin-top: 2px;">Total: <strong style="color: #087f3b;">${window.formatNaira(item.price * item.quantity)}</strong></div>
            </div>
            <div class="cart-item-actions">
              <div class="cart-qty-group">
                <button type="button" class="cart-qty-btn cart-qty-minus" data-id="${item.id}" aria-label="Decrease quantity">&minus;</button>
                <span class="cart-qty-value">${item.quantity}</span>
                <button type="button" class="cart-qty-btn cart-qty-plus" data-id="${item.id}" aria-label="Increase quantity">&plus;</button>
              </div>
              <button type="button" class="cart-item-remove-btn" data-id="${item.id}" title="Remove item" aria-label="Remove item">
                ${window.renderIcon('trash')}
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="cart-checkout-card">
        ${!isLoggedIn ? `
          <div class="cart-auth-notice" style="background: #f0fbf4; border: 1.5px solid #087f3b; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
            <div style="font-weight: 800; color: #073b1f; font-size: 0.94rem; margin-bottom: 4px;">Account Required for Order Placement</div>
            <p style="font-size: 0.82rem; color: #5a6e62; margin-bottom: 12px; line-height: 1.4;">
              To protect your orders and provide instant tracking codes, please sign in or create your free account before completing checkout.
            </p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary btn-sm" id="cartPromptSignInBtn" style="padding: 7px 16px; font-size: 0.82rem;">Sign In</button>
              <button type="button" class="btn btn-secondary btn-sm" id="cartPromptSignUpBtn" style="padding: 7px 16px; font-size: 0.82rem;">Create Account</button>
            </div>
          </div>
        ` : `
          <div class="cart-auth-verified" style="background: #f0fbf4; border: 1px solid #d1ead9; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
            <div style="font-size: 0.82rem; color: #073b1f;">
              Ordering as: <strong>${window.CustomModal.escape(activeUser.first_name || activeUser.name || 'Valued Customer')}</strong> (${window.CustomModal.escape(activeUser.whatsapp_number || activeUser.email || '')})
            </div>
            <span style="font-size: 0.75rem; color: #087f3b; font-weight: 700;">&bull; Verified Account</span>
          </div>
        `}

        <h3 style="color: #073b1f; font-size: 1.18rem; font-weight: 900; margin-bottom: 14px;">Delivery & Checkout</h3>

        <form id="cartCheckoutForm" autocomplete="on">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="c-input-group">
              <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">First Name *</label>
              <input type="text" class="c-input" id="cartFirstName" placeholder="Your first name" required value="${window.CustomModal.escape(activeUser.first_name || activeUser.name?.split(' ')[0] || '')}" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
            </div>
            <div class="c-input-group">
              <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">Last Name *</label>
              <input type="text" class="c-input" id="cartLastName" placeholder="Your last name" required value="${window.CustomModal.escape(activeUser.last_name || activeUser.name?.split(' ')[1] || '')}" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="c-input-group">
              <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">WhatsApp Number *</label>
              <input type="tel" class="c-input" id="cartWhatsApp" placeholder="e.g. 08012345678" required value="${window.CustomModal.escape(activeUser.whatsapp_number || activeUser.phone || '')}" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
            </div>
            <div class="c-input-group">
              <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">Email (Optional)</label>
              <input type="email" class="c-input" id="cartEmail" placeholder="you@domain.com" value="${window.CustomModal.escape(activeUser.email || '')}" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
            </div>
          </div>

          <!-- Nigeria State & LGA Pickers -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="c-input-group">
              <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">Delivery State *</label>
              <div id="cartStatePickerMount"></div>
            </div>
            <div class="c-input-group">
              <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">LGA *</label>
              <div id="cartLgaPickerMount"></div>
            </div>
          </div>

          <div class="c-input-group" style="margin-bottom: 16px;">
            <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">Delivery Street Address *</label>
            <input type="text" class="c-input" id="cartAddress" placeholder="House number, Street, Landmark" required value="${window.CustomModal.escape(activeUser.address || '')}" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
          </div>

          <!-- Price Summary Breakdown -->
          <div style="background: #f7fbf8; border: 1px solid #d1ead9; border-radius: 10px; padding: 14px; margin-bottom: 16px;">
            <div class="cart-summary-line">
              <span>Items Subtotal (${getCartCount()} items):</span>
              <strong>${window.formatNaira(subtotal)}</strong>
            </div>
            <div class="cart-summary-line">
              <span>Nationwide Delivery:</span>
              <span id="cartDeliveryFeeText" style="color: #087f3b; font-weight: 700;">Select State</span>
            </div>
            <div class="cart-summary-line cart-total-line">
              <span>Grand Total:</span>
              <strong id="cartGrandTotalText">${window.formatNaira(subtotal)}</strong>
            </div>
          </div>

          <!-- Protected Checkout Button -->
          <button type="submit" class="btn btn-primary btn-cart-checkout" id="cartCheckoutBtn">
            ${window.renderIcon('orderNow')}
            <span>Confirm & Place Order (${window.formatNaira(subtotal)})</span>
          </button>
        </form>
      </div>
    `;

    // Quantity controls
    container.querySelectorAll('.cart-qty-minus').forEach(btn => {
      btn.addEventListener('click', () => updateCartQuantity(btn.getAttribute('data-id'), -1));
    });
    container.querySelectorAll('.cart-qty-plus').forEach(btn => {
      btn.addEventListener('click', () => updateCartQuantity(btn.getAttribute('data-id'), 1));
    });
    container.querySelectorAll('.cart-item-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.getAttribute('data-id')));
    });

    // Auto-capitalize name inputs
    const fnInput = container.querySelector('#cartFirstName');
    const lnInput = container.querySelector('#cartLastName');
    if (window.attachNameAutoCapitalize) {
      window.attachNameAutoCapitalize(fnInput);
      window.attachNameAutoCapitalize(lnInput);
    }

    // State & LGA pickers
    let selectedState = activeUser.state || '';
    let selectedLga = activeUser.lga || '';

    const stateMount = container.querySelector('#cartStatePickerMount');
    const lgaMount = container.querySelector('#cartLgaPickerMount');

    const updateDeliveryFee = () => {
      const delText = container.querySelector('#cartDeliveryFeeText');
      const totalText = container.querySelector('#cartGrandTotalText');
      const checkoutBtn = container.querySelector('#cartCheckoutBtn');
      if (!delText || !totalText) return;

      let fee = 0;
      if (selectedState) {
        fee = 3500;
        delText.textContent = window.formatNaira(fee);
      } else {
        delText.textContent = 'Select State';
      }
      const grandTotal = subtotal + fee;
      totalText.textContent = window.formatNaira(grandTotal);
      if (checkoutBtn && !checkoutBtn.disabled) {
        checkoutBtn.innerHTML = `
          ${window.renderIcon('orderNow')}
          <span>Confirm & Place Order (${window.formatNaira(grandTotal)})</span>
        `;
      }
    };

    let lgaPicker = null;
    const initLgaPicker = (st) => {
      const lgas = (window.NIGERIA_STATES && window.NIGERIA_STATES[st]) || [];
      const opts = lgas.map(l => ({ value: l, label: l }));
      if (lgaPicker) {
        lgaPicker.updateOptions(opts, selectedLga || (lgas[0] || ''));
      } else if (lgaMount && window.CustomPicker) {
        lgaPicker = window.CustomPicker.create({
          container: lgaMount,
          title: 'Select Delivery LGA',
          options: opts,
          value: selectedLga,
          placeholder: 'Select LGA',
          searchable: true,
          onChange: (val) => { selectedLga = val; }
        });
      }
    };

    if (stateMount && window.CustomPicker) {
      const states = Object.keys(window.NIGERIA_STATES || {}).map(s => ({ value: s, label: s }));
      window.CustomPicker.create({
        container: stateMount,
        title: 'Select Delivery State',
        options: states,
        value: selectedState,
        placeholder: 'Select State',
        searchable: true,
        onChange: (val) => {
          selectedState = val;
          selectedLga = '';
          initLgaPicker(val);
          updateDeliveryFee();
        }
      });
      if (selectedState) {
        initLgaPicker(selectedState);
        updateDeliveryFee();
      }
    }

    // Auth Prompt Triggers in Cart
    container.querySelector('#cartPromptSignInBtn')?.addEventListener('click', () => {
      if (window.AuthModal) window.AuthModal.showSignIn(() => renderCartView());
    });
    container.querySelector('#cartPromptSignUpBtn')?.addEventListener('click', () => {
      if (window.AuthModal) window.AuthModal.showSignUp(() => renderCartView());
    });

    // Checkout Form Submission (Double Click Prevention & Processing State)
    let isSubmittingCartOrder = false;
    const checkoutForm = container.querySelector('#cartCheckoutForm');
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmittingCartOrder) return;

      // Enforce Account Verification Before Order Placement
      const verifiedUser = (window.SupabaseService.getCurrentUser && window.SupabaseService.getCurrentUser()) ||
                           (window.SupabaseService.getActiveUser && window.SupabaseService.getActiveUser());
      if (!verifiedUser || !verifiedUser.id) {
        window.CustomModal.confirm({
          title: 'Account Required',
          message: 'An account is required to place your order, generate your official invoice, and track delivery progress. Would you like to sign in or register now?',
          confirmText: 'Sign In / Register',
          cancelText: 'Cancel',
          onConfirm: () => {
            if (window.AuthModal) {
              window.AuthModal.showSignIn(() => renderCartView());
            }
          }
        });
        return;
      }

      const firstName = window.capitalizeName ? window.capitalizeName(fnInput.value) : fnInput.value.trim();
      const lastName = window.capitalizeName ? window.capitalizeName(lnInput.value) : lnInput.value.trim();
      const whatsapp = container.querySelector('#cartWhatsApp').value.trim();
      const email = container.querySelector('#cartEmail').value.trim();
      const address = container.querySelector('#cartAddress').value.trim();

      if (!firstName || !lastName || !whatsapp || !address) {
        window.CustomModal.toast({ message: 'Please fill in all required delivery fields.', type: 'danger' });
        return;
      }

      if (!selectedState || !selectedLga) {
        window.CustomModal.toast({ message: 'Please select your delivery State and LGA.', type: 'warning' });
        return;
      }

      const checkoutBtn = container.querySelector('#cartCheckoutBtn');
      isSubmittingCartOrder = true;
      checkoutBtn.disabled = true;
      checkoutBtn.style.cursor = 'not-allowed';
      checkoutBtn.innerHTML = `
        <span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:6px;"></span>
        <span>Processing Order...</span>
      `;

      const currentCart = getCart();
      const itemsSummary = currentCart.map(i => `${i.title} (x${i.quantity})`).join(', ');
      const deliveryFee = selectedState ? 3500 : 0;
      const totalAmount = subtotal + deliveryFee;
      const orderId = `ord-${Date.now()}`;
      const coverImg = currentCart[0]?.image || 'assets/images/logo.png';

      const orderData = {
        id: orderId,
        retrieval_code: `NKG-${Date.now()}`,
        user_id: verifiedUser.id,
        product_id: currentCart[0]?.id || 'cart-order',
        product_title: `Cart Order (${currentCart.length} items): ${itemsSummary}`,
        product_price: totalAmount,
        product_image: coverImg,
        first_name: firstName,
        last_name: lastName,
        whatsapp_number: whatsapp,
        email: email || null,
        state: selectedState,
        lga: selectedLga,
        address: address,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      try {
        await window.SupabaseService.createOrder(orderData);

        // Send rich Order Card into chat
        if (activeUser.id) {
          const orderChatMessage = {
            id: `msg-ord-${orderData.id}`,
            order_code: orderData.id,
            user_id: activeUser.id,
            user_name: `${firstName} ${lastName}`,
            user_whatsapp: whatsapp,
            sender: 'user',
            message_type: 'order_card',
            order_data: {
              ...orderData,
              id: orderData.id,
              order_id: orderData.id,
              first_name: firstName,
              last_name: lastName,
              whatsapp_number: whatsapp,
              email: email || null,
              state: selectedState,
              lga: selectedLga,
              address: address,
              delivery_address: `${address}, ${selectedLga}, ${selectedState}`,
              status: 'pending',
              created_at: orderData.created_at
            },
            message: `Order Placed: ${orderData.product_title} (${window.formatNaira(totalAmount)}) - Status: Pending`,
            image_url: null,
            is_read_by_admin: false,
            is_read_by_user: true,
            deleted_for_everyone: false,
            deleted_for_user: false,
            deleted_for_admin: false,
            created_at: new Date().toISOString()
          };
          await window.SupabaseService.sendUserChatMessage(orderChatMessage);
        }

        // Clear cart
        saveCart([]);
        isSubmittingCartOrder = false;

        // Open Order Success Modal & Receipt Download
        openOrderSuccessModal(orderData);
      } catch (err) {
        console.error('Cart order placement notice:', err);
        saveCart([]);
        isSubmittingCartOrder = false;
        openOrderSuccessModal(orderData);
      }
    });
  }

  /* ==========================================================================
     8. REQUESTS VIEW (Orders & Sourcing Requests Tracking)
     ========================================================================== */
  async function renderRequestsView() {
    const container = document.getElementById('requestsListContainer');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #5a6e62;">
        <span class="spinner" style="display:inline-block; width:24px; height:24px; border:2.5px solid #087f3b; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-bottom:8px;"></span>
        <div>Loading your orders and sourcing requests...</div>
      </div>
    `;

    const activeUser = window.SupabaseService.getActiveUser ? window.SupabaseService.getActiveUser() : {};
    let orders = [];

    try {
      if (window.SupabaseService.getUserOrdersSync) {
        orders = window.SupabaseService.getUserOrdersSync(activeUser.id, activeUser.phone, activeUser.email);
      }
    } catch (e) {}

    try {
      if (window.SupabaseService.getUserOrders) {
        const fresh = await window.SupabaseService.getUserOrders(activeUser.id, activeUser.phone, activeUser.email, 2000);
        if (fresh && fresh.length > 0) orders = fresh;
      }
    } catch (e) {}

    const searchInput = document.getElementById('requestsSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = orders;
    if (query) {
      filtered = orders.filter(o => {
        const title = (o.product_title || '').toLowerCase();
        const code = (o.retrieval_code || o.id || '').toLowerCase();
        return title.includes(query) || code.includes(query);
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">${window.renderIcon('requests')}</div>
          <h3 class="cart-empty-title">No Orders or Requests Found</h3>
          <p class="cart-empty-sub">When you place orders or submit sourcing requests via "Everything Dey", they will appear here with live tracking.</p>
          <button class="btn btn-primary" type="button" id="reqStartShoppingBtn" style="padding: 12px 28px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;">
            ${window.renderIcon('shop')}
            <span>Start Shopping Now</span>
          </button>
        </div>
      `;
      container.querySelector('#reqStartShoppingBtn')?.addEventListener('click', () => {
        window.switchAppTab('shop');
      });
      return;
    }

    container.innerHTML = filtered.map(o => {
      const status = (o.status || 'pending').toLowerCase();
      const code = o.retrieval_code || o.id || '';
      const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';

      return `
        <div class="requests-card">
          <div class="request-card-top">
            <div>
              <h4 class="request-card-title">${window.CustomModal.escape(o.product_title || 'Order')}</h4>
              <div style="font-size: 0.78rem; color: #5a6e62; margin-top: 2px;">Placed on ${dateStr}</div>
            </div>
            <span class="request-status-pill ${status}">${status}</span>
          </div>

          <div class="request-card-info">
            <div><strong>Code:</strong> <span class="request-code-badge">${code}</span></div>
            <div><strong>Amount:</strong> <span style="color: #087f3b; font-weight: 800;">${Number(o.product_price) > 0 ? window.formatNaira(o.product_price) : 'Quote Pending'}</span></div>
            ${o.state ? `<div><strong>Destination:</strong> ${window.CustomModal.escape(o.lga || '')}, ${window.CustomModal.escape(o.state)}</div>` : ''}
          </div>

          <div class="request-card-actions">
            ${Number(o.product_price) > 0 ? `
              <button type="button" class="btn btn-secondary btn-sm req-download-btn" data-id="${o.id}" style="padding: 6px 12px; font-size: 0.78rem;">
                ${window.renderIcon('download')}
                <span>Download Receipt</span>
              </button>
            ` : ''}
            <a href="https://wa.me/2347042087633?text=${encodeURIComponent(`Hello Nkem Global, I am inquiring about my request (${code}): ${o.product_title}`)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="padding: 6px 12px; font-size: 0.78rem; color: #166534; border-color: #25D366; text-decoration: none;">
              ${window.renderIcon('whatsapp')}
              <span>WhatsApp Support</span>
            </a>
            <button type="button" class="btn btn-secondary btn-sm req-copy-btn" data-code="${code}" style="padding: 6px 12px; font-size: 0.78rem;">
              ${window.renderIcon('copy')}
              <span>Copy Code</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners
    container.querySelectorAll('.req-download-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.getAttribute('data-id');
        const order = filtered.find(o => o.id === orderId);
        if (order) {
          window.CustomModal.toast({ message: 'Generating official receipt...', type: 'info' });
          await window.ReceiptGenerator.downloadReceiptImage(order);
          window.CustomModal.toast({ message: 'Receipt downloaded!', type: 'success' });
        }
      });
    });

    container.querySelectorAll('.req-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        navigator.clipboard?.writeText(code);
        window.CustomModal.toast({ message: `Copied code: ${code}`, type: 'success' });
      });
    });
  }

  /* ==========================================================================
     9. ACCOUNT VIEW (Profile, Live Chat, WhatsApp & Support)
     ========================================================================== */
  function renderAccountView() {
    const container = document.getElementById('accountContentContainer');
    if (!container) return;

    const activeUser = window.SupabaseService.getActiveUser ? window.SupabaseService.getActiveUser() : null;
    const isLoggedIn = !!(activeUser && activeUser.id);
    const orders = window.SupabaseService.getLocalOrders ? window.SupabaseService.getLocalOrders() : [];

    container.innerHTML = `
      <div class="account-card-box">
        <div class="account-profile-header">
          <div class="account-avatar-circle">
            ${isLoggedIn ? (activeUser.name ? activeUser.name.charAt(0).toUpperCase() : 'U') : `${window.renderIcon('account')}`}
          </div>
          <div>
            <h3 class="account-user-name">${isLoggedIn ? window.CustomModal.escape(activeUser.name || `${activeUser.first_name || ''} ${activeUser.last_name || ''}`) : 'Welcome to Nkem Global'}</h3>
            <div class="account-user-phone">${isLoggedIn ? window.CustomModal.escape(activeUser.phone || activeUser.email || 'Verified Customer') : 'Sign in to track orders, manage your profile and chat.'}</div>
          </div>
        </div>

        ${isLoggedIn ? `
          <div style="background: #f7fbf8; border: 1px solid #d1ead9; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; display: flex; justify-content: space-around; text-align: center;">
            <div>
              <div style="font-size: 1.25rem; font-weight: 900; color: #087f3b;">${orders.length}</div>
              <div style="font-size: 0.74rem; color: #5a6e62; font-weight: 700;">Orders / Requests</div>
            </div>
            <div style="border-left: 1px solid #d1ead9;"></div>
            <div>
              <div style="font-size: 1.25rem; font-weight: 900; color: #087f3b;">${activeUser.state || 'NG'}</div>
              <div style="font-size: 0.74rem; color: #5a6e62; font-weight: 700;">Delivery State</div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="accountEditProfileBtn" style="flex: 1; justify-content: center; padding: 9px 12px;">
              ${window.renderIcon('edit')}
              <span>Change Password / Profile</span>
            </button>
            <button type="button" class="btn btn-danger btn-sm" id="accountLogoutBtn" style="padding: 9px 14px; justify-content: center;">
              <span>Log Out</span>
            </button>
          </div>
        ` : `
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn btn-primary" id="accountSignInBtn" style="flex: 1; justify-content: center; padding: 11px; background-color: #087f3b; border-color: #087f3b;">
              <span>Sign In</span>
            </button>
            <button type="button" class="btn btn-secondary" id="accountRegisterBtn" style="flex: 1; justify-content: center; padding: 11px;">
              <span>Create Account</span>
            </button>
          </div>
          <div style="text-align: center; margin-top: 10px;">
            <button type="button" id="accountForgotBtn" style="background: none; border: none; color: #087f3b; font-size: 0.84rem; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 4px 8px;">
              Forgot Password?
            </button>
          </div>
        `}
      </div>

      <!-- Support & Direct Communication Card -->
      <div class="account-card-box">
        <h4 style="color: #073b1f; font-size: 1.05rem; font-weight: 800; margin-bottom: 12px;">Support & Contact Channels</h4>

        <a href="chat.html" class="account-support-btn">
          <div class="support-left">
            <span style="color: #087f3b;">${window.renderIcon('chat')}</span>
            <span>Live Support Cloud Chat</span>
          </div>
          <span class="support-action-link">
            <span>Open Chat</span>
            <svg class="support-chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>

        <a href="https://wa.me/2347042087633?text=Hello%20Nkem%20Global%2C%20I%20am%20inquiring%20about%20my%20account" target="_blank" rel="noopener" class="account-support-btn">
          <div class="support-left">
            <span style="color: #25D366;">${window.renderIcon('whatsapp')}</span>
            <span>WhatsApp Official Support (07042087633)</span>
          </div>
          <span class="support-action-link">
            <span>Chat</span>
            <svg class="support-chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>

        <a href="tel:08155608447" class="account-support-btn">
          <div class="support-left">
            <span style="color: #087f3b;">${window.renderIcon('phone')}</span>
            <span>Direct Phone Call (08155608447)</span>
          </div>
          <span class="support-action-link">
            <span>Call</span>
            <svg class="support-chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>
      </div>
    `;

    // Hook up buttons
    container.querySelector('#accountSignInBtn')?.addEventListener('click', () => {
      if (window.AuthModal) {
        window.AuthModal.showSignIn(() => renderAccountView());
      }
    });
    container.querySelector('#accountRegisterBtn')?.addEventListener('click', () => {
      if (window.AuthModal) {
        window.AuthModal.showSignUp(() => renderAccountView());
      }
    });
    container.querySelector('#accountForgotBtn')?.addEventListener('click', () => {
      if (window.AuthModal && window.AuthModal.showForgotPassword) {
        window.AuthModal.showForgotPassword(() => renderAccountView());
      }
    });
    container.querySelector('#accountEditProfileBtn')?.addEventListener('click', () => {
      if (window.AuthModal) {
        window.AuthModal.showProfile(() => renderAccountView());
      }
    });
    container.querySelector('#accountLogoutBtn')?.addEventListener('click', () => {
      window.CustomModal.confirm({
        title: 'Confirm Logout',
        message: 'Are you sure you want to log out of your Nkem Global account?',
        confirmText: 'Log Out',
        onConfirm: () => {
          window.SupabaseService.logoutUser();
          renderAccountView();
          window.CustomModal.toast({ message: 'Logged out successfully.', type: 'info' });
        }
      });
    });
  }

  /* ==========================================================================
     10. ORDER CONFIRMATION MODAL & RECEIPT DOWNLOAD
     ========================================================================== */
  function openOrderSuccessModal(order) {
    if (!orderSuccessModal) return;
    orderSuccessModal.innerHTML = `
      <div class="c-modal-box" style="max-width: 500px;">
        <div class="c-modal-header">
          <div class="c-modal-title-wrap">
            <h3 class="c-modal-title" style="color: #087f3b;">Order Request Received!</h3>
          </div>
          <button class="c-modal-close-btn" type="button" id="closeSuccessModalBtn">
            ${window.renderIcon('close')}
          </button>
        </div>

        <div class="c-modal-body receipt-modal-box">
          <p class="c-modal-text">
            Thank you, <strong>${window.CustomModal.escape(order.first_name)} ${window.CustomModal.escape(order.last_name)}</strong>! Your order request for <strong>${window.CustomModal.escape(order.product_title)}</strong> has been recorded.
          </p>

          <div style="background: #f7fbf8; border: 1.5px solid #d1ead9; border-radius: 10px; padding: 14px; margin: 12px 0; font-size: 0.85rem; line-height: 1.6; text-align: left;">
            <div><strong>Item:</strong> ${window.CustomModal.escape(order.product_title)}</div>
            <div><strong>Total:</strong> <span style="color: #087f3b; font-weight: 800;">${window.formatNaira(order.product_price)}</span></div>
            <div><strong>Destination:</strong> ${window.CustomModal.escape(order.lga || '')}, ${window.CustomModal.escape(order.state || '')}</div>
            <div><strong>WhatsApp:</strong> ${window.CustomModal.escape(order.whatsapp_number)}</div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #d1ead9;">
              <strong>Retrieval Code:</strong> <span style="font-family: monospace; font-weight: 700; background: #e8f7ee; padding: 2px 6px; border-radius: 4px; color: #064e26;">${order.retrieval_code || order.id}</span>
            </div>
          </div>

          <div class="code-actions-row">
            <button class="btn btn-primary" type="button" id="downloadReceiptImgBtn" style="flex: 1; justify-content: center; padding: 12px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;">
              ${window.renderIcon('download')}
              <span>Download Official Receipt</span>
            </button>
          </div>

          <p style="font-size: 0.78rem; color: #5a6e62; margin-top: 8px;">
            The downloaded receipt carries Nkem Global brand logo, shop contact info, and complete order specifications.
          </p>

          <div style="padding-top: 12px; border-top: 1px solid #d1ead9; margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center; background-color: #065f2c; border-color: #065f2c;" type="button" id="trackInOrdersBtn">
              <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>Track in Requests Tab</span>
            </button>
            <a href="chat.html" class="btn btn-secondary" style="width: 100%; justify-content: center; text-decoration: none;">
              ${window.renderIcon('chat')}
              <span>Open Direct Chat with Support</span>
            </a>
            <button class="btn btn-secondary" style="width: 100%; justify-content: center;" type="button" id="closeSuccessBtn">
              <span>Continue Shopping</span>
            </button>
          </div>
        </div>
      </div>
    `;

    orderSuccessModal.querySelector('#downloadReceiptImgBtn')?.addEventListener('click', async () => {
      window.CustomModal.toast({ message: 'Generating receipt with Nkem Global contact info...', type: 'info' });
      await window.ReceiptGenerator.downloadReceiptImage(order);
      window.CustomModal.toast({ message: 'Receipt image downloaded!', type: 'success' });
    });

    const closeSuccess = () => orderSuccessModal.classList.remove('active');
    orderSuccessModal.querySelector('#closeSuccessModalBtn')?.addEventListener('click', closeSuccess);
    orderSuccessModal.querySelector('#closeSuccessBtn')?.addEventListener('click', closeSuccess);

    const trackBtn = orderSuccessModal.querySelector('#trackInOrdersBtn');
    if (trackBtn) {
      trackBtn.addEventListener('click', () => {
        closeSuccess();
        window.switchAppTab('requests');
      });
    }

    orderSuccessModal.classList.add('active');
  }

  /* ==========================================================================
     11. REALTIME CHAT UNREAD BADGE & URL HASH INITIALIZATION
     ========================================================================== */
  async function checkUnreadMessages() {
    try {
      const activeUser = window.SupabaseService.getActiveUser ? window.SupabaseService.getActiveUser() : null;
      if (!activeUser || !activeUser.id) return;
      const count = await window.SupabaseService.getUnreadCountForUser(activeUser.id);
      const deskAccountBtn = document.getElementById('deskAccountNavBtn');
      if (deskAccountBtn && activeUser.name) {
        deskAccountBtn.textContent = activeUser.name.split(' ')[0] || 'Account';
      }
    } catch (e) {}
  }

  // Setup Search in Requests Tab
  const reqSearchInput = document.getElementById('requestsSearchInput');
  if (reqSearchInput) {
    reqSearchInput.addEventListener('input', () => {
      renderRequestsView();
    });
  }

  // Setup Clear Cart Button
  const cartClearBtn = document.getElementById('cartClearBtn');
  if (cartClearBtn) {
    cartClearBtn.addEventListener('click', () => {
      window.CustomModal.confirm({
        title: 'Clear Shopping Cart',
        message: 'Are you sure you want to remove all items from your cart?',
        confirmText: 'Clear Cart',
        onConfirm: clearCart
      });
    });
  }

  // Initialize Tab listeners, View Layout Toggle & Hero Request Form
  initTabListeners();
  initViewToggle();
  initHeroRequestForm();

  // Load Initial Data
  await loadInitialData();

  // Handle URL hash on load (e.g. #shop, #cart, #requests, #account, #home)
  const hash = (window.location.hash || '').replace('#', '').toLowerCase();
  if (['home', 'shop', 'requests', 'cart', 'account'].includes(hash)) {
    window.switchAppTab(hash);
  } else {
    window.switchAppTab('home');
  }
});
