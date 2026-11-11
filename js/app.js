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
    homePromotedCategory: null,
    selectedSort: 'newest',
    pageSize: 16, // STRICT 16-ROW CATALOG RULE
    hasMoreProducts: false,
    isLoadingMore: false,
    productCardTimers: {},
    currentView: localStorage.getItem('nkem_product_view') || 'grid',
    cart: []
  };

  // Helper to get active authenticated user across all storage/service keys
  function getActiveUser() {
    if (window.SupabaseService) {
      if (typeof window.SupabaseService.getCurrentUser === 'function') {
        const u = window.SupabaseService.getCurrentUser();
        if (u && (u.id || u.whatsapp_number)) return u;
      }
      if (typeof window.SupabaseService.getActiveUser === 'function') {
        const u = window.SupabaseService.getActiveUser();
        if (u && (u.id || u.whatsapp_number)) return u;
      }
    }
    try {
      const raw = localStorage.getItem('nkem_current_user') || localStorage.getItem('nkem_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // Reactive UI update on authentication state change
  window.addEventListener('nkem_auth_changed', (evt) => {
    try {
      const user = evt?.detail?.user || getActiveUser();
      if (user && user.id) {
        syncCartWithCloud(true);
      }
      // Never wipe local cart on auth check or guest mode
      renderAccountView();
      renderCartView();
      renderRequestsView();
      updateCartBadges();
      checkUnreadMessages();
    } catch (_) {}
  });

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

  let lastLocalCartMutationTime = 0;
  let isSyncingCartToCloud = false;
  let lastExplicitClearTime = 0;

  function saveCart(cart, skipCloud = false) {
    const safeCart = Array.isArray(cart) ? cart : [];
    try {
      if (safeCart.length === 0) {
        localStorage.removeItem('nkem_cart');
      } else {
        localStorage.setItem('nkem_cart', JSON.stringify(safeCart));
      }
    } catch (e) {}
    state.cart = safeCart;
    updateCartBadges();

    // Multi-device Cloud Cart Sync
    if (!skipCloud) {
      lastLocalCartMutationTime = Date.now();
      const activeUser = getActiveUser();
      if (activeUser && activeUser.id && window.SupabaseService?.syncUserCartToCloud) {
        isSyncingCartToCloud = true;
        window.SupabaseService.syncUserCartToCloud(activeUser.id, safeCart)
          .catch(err => console.warn('Cloud cart sync dispatch notice:', err))
          .finally(() => {
            isSyncingCartToCloud = false;
          });
      }
    }
  }

  // Multi-device Cart Cloud Sync engine
  async function syncCartWithCloud(isInitialLogin = false) {
    const activeUser = getActiveUser();
    if (!activeUser || !activeUser.id || !window.SupabaseService?.getUserCartFromCloud) return;

    // Guard against race conditions right after local mutations (wait 10s after local action)
    if (!isInitialLogin && (isSyncingCartToCloud || (Date.now() - lastLocalCartMutationTime < 10000))) {
      return;
    }

    try {
      const cloudCart = await window.SupabaseService.getUserCartFromCloud(activeUser.id);
      // If network failed, timed out, or returned null -> DO NOT TOUCH local cart
      if (cloudCart === null || !Array.isArray(cloudCart)) return;

      const localCart = getCart();

      // If user recently explicitly cleared or placed an order, never resurrect old items from cloud
      if (Date.now() - lastExplicitClearTime < 120000) {
        if (cloudCart.length > 0) {
          window.SupabaseService.syncUserCartToCloud(activeUser.id, []).catch(() => {});
        }
        return;
      }

      // Initial login on fresh device (no local cart, but user has saved cloud cart):
      if (isInitialLogin) {
        if (localCart.length === 0 && cloudCart.length > 0) {
          saveCart(cloudCart, true);
          if (state.currentTab === 'cart') renderCartView();
          return;
        }
        if (localCart.length > 0) {
          // Merge guest cart with cloud cart
          const mergedMap = new Map();
          cloudCart.forEach(item => { if (item && item.id) mergedMap.set(item.id, { ...item }); });
          localCart.forEach(item => {
            if (item && item.id) {
              if (mergedMap.has(item.id)) {
                const existing = mergedMap.get(item.id);
                existing.quantity = Math.max(Number(existing.quantity) || 1, Number(item.quantity) || 1);
              } else {
                mergedMap.set(item.id, { ...item });
              }
            }
          });
          const mergedCart = Array.from(mergedMap.values());
          saveCart(mergedCart, false);
          if (state.currentTab === 'cart') renderCartView();
          return;
        }
      }

      // Active in-session background polling:
      // Local cart is authoritative. If local cart is empty, keep cloud cart empty!
      if (localCart.length === 0) {
        if (cloudCart.length > 0) {
          window.SupabaseService.syncUserCartToCloud(activeUser.id, []).catch(() => {});
        }
        return;
      }

      // If local has items and cloud differs, push local to cloud
      if (JSON.stringify(localCart) !== JSON.stringify(cloudCart)) {
        window.SupabaseService.syncUserCartToCloud(activeUser.id, localCart).catch(() => {});
      }
    } catch (e) {
      console.warn('Sync cart notice:', e);
    }
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
    lastExplicitClearTime = Date.now();
    lastLocalCartMutationTime = Date.now();
    saveCart([]);
    renderCartView();
    const activeUser = getActiveUser();
    if (activeUser && activeUser.id && window.SupabaseService?.syncUserCartToCloud) {
      window.SupabaseService.syncUserCartToCloud(activeUser.id, []).catch(() => {});
    }
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
      state.homePromotedCategory = categoryToFilter;
    } else if (tabName === 'shop') {
      state.homePromotedCategory = null;
    }

    // Tab-specific rendering
    if (tabName === 'home') {
      renderHomeCategories();
    } else if (tabName === 'shop') {
      renderShopCategoryPills();
      applyFiltersAndSort();
    } else if (tabName === 'cart') {
      renderCartView();
      syncCartWithCloud();
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
      const cachedProducts = window.SupabaseService.getLocalProducts ? window.SupabaseService.getLocalProducts(false) : [];

      if (cachedCategories.length > 0) state.categories = cachedCategories;
      const suitFallbackDesc = 'These particular suits are authentic Italian bespoke cuts, crafted with premium high-twist wool blend fabric for exceptional drape, comfort, and structure. Designed with classic notch lapels, flap pockets, soft interior lining, and dual side vents. Meticulously finished for modern executives and high-profile occasions.';
      state.products = (cachedProducts || []).filter(p => !window.SupabaseService?.isProductHidden?.(p)).map(p => {
        const raw = p.description || p.desc || p.details || p.product_description || '';
        if (!raw || typeof raw !== 'string' || !raw.trim()) {
          return { ...p, description: suitFallbackDesc };
        }
        return p;
      });

      renderHomeCategories();
      renderShopCategoryPills();
      initToolbars();
      initSeeMore();
      applyFiltersAndSort();
      updateCartBadges();
      checkUnreadMessages();
      syncCartWithCloud();
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
          sort: state.selectedSort,
          includeHidden: false
        })
      ]);

      if (categories && categories.length > 0) state.categories = categories;

      const suitFallbackDesc = 'These particular suits are authentic Italian bespoke cuts, crafted with premium high-twist wool blend fabric for exceptional drape, comfort, and structure. Designed with classic notch lapels, flap pockets, soft interior lining, and dual side vents. Meticulously finished for modern executives and high-profile occasions.';
      if (Array.isArray(products)) {
        state.products = products.filter(p => !window.SupabaseService?.isProductHidden?.(p)).map(p => {
          const raw = p.description || p.desc || p.details || p.product_description || '';
          if (!raw || typeof raw !== 'string' || !raw.trim()) {
            return { ...p, description: suitFallbackDesc };
          }
          return p;
        });
      }
      state.hasMoreProducts = Array.isArray(products) && products.length === state.pageSize;

      renderHomeCategories();
      renderShopCategoryPills();
      initToolbars();
      initSeeMore();
      applyFiltersAndSort();
      updateCartBadges();
      checkUnreadMessages();
      syncCartWithCloud();
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

    const activeUser = getActiveUser() || {};
    const isLoggedIn = !!(activeUser && (activeUser.id || activeUser.whatsapp_number));

    body.innerHTML = `
      <div style="background: #e8f7ee; padding: 14px 16px; border-radius: 10px; border: 1.5px solid #d1ead9; margin-bottom: 16px;">
        <div style="font-size: 0.74rem; font-weight: 800; color: #087f3b; text-transform: uppercase; letter-spacing: 0.04em;">You Are Requesting:</div>
        <div style="font-size: 1.15rem; font-weight: 900; color: #064e26; margin-top: 3px;">${window.CustomModal.escape(itemQuery)}</div>
        <div style="font-size: 0.78rem; color: #5a6e62; margin-top: 4px;">Our procurement team will send you 2 best options with photos within 30 minutes!</div>
      </div>

      ${!isLoggedIn ? `
        <div style="background: #f0fbf4; border: 1.5px solid #087f3b; border-radius: 12px; padding: 20px 16px; text-align: center; margin-bottom: 14px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #e2f5ea; color: #087f3b; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; font-size: 19px;">
            ${window.renderIcon('user')}
          </div>
          <div style="font-weight: 800; color: #073b1f; font-size: 0.98rem; margin-bottom: 6px;">Sign In or Register to Submit</div>
          <p style="font-size: 0.82rem; color: #5a6e62; margin-bottom: 16px; line-height: 1.4;">
            Please sign in or create a free account so our procurement team can link this request to your profile and send you options on WhatsApp.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="sourcingPromptSignInBtn" style="padding: 9px 20px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;">Sign In</button>
            <button type="button" class="btn btn-secondary btn-sm" id="sourcingPromptSignUpBtn" style="padding: 9px 20px; font-weight: 800; border-color: #087f3b; color: #087f3b; background: #ffffff;">Create Account</button>
          </div>
        </div>

        <a href="https://wa.me/2348155608447?text=${encodeURIComponent(`Hello Nkem Global, I am requesting: ${itemQuery}. Please send me 2 best options with pictures within 30 minutes!`)}" target="_blank" rel="noopener" class="btn btn-secondary" style="width: 100%; justify-content: center; padding: 11px; font-weight: 700; color: #166534; border-color: #25D366; text-decoration: none;">
          ${window.renderIcon('whatsapp')}
          <span>Send Directly on WhatsApp (+234 815 560 8447)</span>
        </a>
      ` : `
        <div style="background: #f7fbf8; border: 1px solid #d1ead9; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
          <div style="font-size: 0.82rem; color: #073b1f;">
            Requesting as: <strong>${window.CustomModal.escape(activeUser.first_name || activeUser.name || 'Valued Customer')}</strong> (${window.CustomModal.escape(activeUser.whatsapp_number || activeUser.phone || '')})
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="sourcingEditProfileBtn" style="padding: 4px 10px; font-size: 0.75rem; border-color: #087f3b; color: #087f3b; background: #ffffff;">Change</button>
        </div>

        <form id="customSourcingForm" autocomplete="on">
          <div class="c-input-group" style="margin-bottom: 14px;">
            <label class="c-input-label" style="display: block; font-size: 0.76rem; color: #5a6e62; font-weight: 700; margin-bottom: 4px;">Target Budget / Specific Details (Optional)</label>
            <input type="text" class="c-input" id="reqUserNotes" placeholder="e.g. Budget â‚¦250k, Brand new, Size 42, Black color" style="padding: 10px 12px; border-radius: 8px; border: 1.5px solid #d1ead9; background: #ffffff;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
            <button type="submit" class="btn btn-primary" id="submitSourcingBtn" style="width: 100%; justify-content: center; padding: 12px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;">
              ${window.renderIcon('send')}
              <span>Submit Sourcing Request</span>
            </button>

            <a href="https://wa.me/2348155608447?text=${encodeURIComponent(`Hello Nkem Global, I am requesting: ${itemQuery}. Please send me 2 best options with pictures within 30 minutes!`)}" target="_blank" rel="noopener" class="btn btn-secondary" style="width: 100%; justify-content: center; padding: 11px; font-weight: 700; color: #166534; border-color: #25D366; text-decoration: none;">
              ${window.renderIcon('whatsapp')}
              <span>Send Directly on WhatsApp (+234 815 560 8447)</span>
            </a>
          </div>
        </form>
      `}
    `;

    const closeBtn = customRequestModal.querySelector('#closeCustomRequestBtn');
    const closeModal = () => customRequestModal.classList.remove('active');
    if (closeBtn) closeBtn.onclick = closeModal;

    if (!isLoggedIn) {
      body.querySelector('#sourcingPromptSignInBtn')?.addEventListener('click', () => {
        closeModal();
        if (window.AuthModal) {
          window.AuthModal.showSignIn(() => openCustomSourcingRequestModal(itemQuery));
        }
      });
      body.querySelector('#sourcingPromptSignUpBtn')?.addEventListener('click', () => {
        closeModal();
        if (window.AuthModal) {
          window.AuthModal.showSignUp(() => openCustomSourcingRequestModal(itemQuery));
        }
      });
    } else {
      body.querySelector('#sourcingEditProfileBtn')?.addEventListener('click', () => {
        if (window.AuthModal) {
          window.AuthModal.showProfile('profile', () => openCustomSourcingRequestModal(itemQuery));
        }
      });

      const form = body.querySelector('#customSourcingForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const userNotes = (body.querySelector('#reqUserNotes')?.value || '').trim();

          const submitBtn = body.querySelector('#submitSourcingBtn');
          submitBtn.disabled = true;
          submitBtn.innerHTML = `
            <span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:6px;"></span>
            <span>Submitting Request...</span>
          `;

          const reqId = `sreq-${Date.now()}`;
          const userName = [activeUser.first_name, activeUser.last_name].filter(Boolean).join(' ') || activeUser.name || 'Valued Customer';
          const userPhone = activeUser.whatsapp_number || activeUser.phone || '';

          const sourcingData = {
            request_id: reqId,
            item: itemQuery,
            notes: userNotes || null,
            user_id: activeUser.id,
            user_name: userName,
            user_whatsapp: userPhone,
            created_at: new Date().toISOString()
          };

          const msgObj = {
            id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            order_code: activeUser.id,
            user_id: activeUser.id,
            user_name: userName,
            user_whatsapp: userPhone,
            sender: 'user',
            message_type: 'sourcing_request',
            sourcing_data: sourcingData,
            message: `[SOURCING_REQUEST]:::${JSON.stringify(sourcingData)}`,
            image_url: null,
            is_edited: false,
            is_read_by_admin: false,
            is_read_by_user: true,
            deleted_for_everyone: false,
            deleted_for_user: false,
            deleted_for_admin: false,
            created_at: new Date().toISOString()
          };

          try {
            await window.SupabaseService.sendUserChatMessage(msgObj);
          } catch (err) {
            console.warn('Failed to send sourcing chat message:', err);
          }

          closeModal();
          window.CustomModal.toast({
            message: 'Sourcing request sent to Live Chat! Opening Live Chat...',
            type: 'success'
          });

          // Redirect to Live Chat where special sourcing request bubble is displayed
          window.location.href = 'chat.html';
        });
      }
    }

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
      let img = c.image_url || 'assets/images/logo.png';
      if (img.startsWith('assets/categories/') && !img.includes('?v=')) {
        img += '?v=20261109_1';
      }
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

    // Check if a category was clicked from the Home Screen and needs promotion to the first position
    let promotedCat = null;
    let otherCategories = [...categories];

    if (state.homePromotedCategory) {
      const targetStr = String(state.homePromotedCategory).toLowerCase().trim();
      const matchIdx = otherCategories.findIndex(c => 
        (c.name && c.name.toLowerCase().trim() === targetStr) ||
        (c.id && c.id.toLowerCase().trim() === targetStr)
      );
      if (matchIdx >= 0) {
        promotedCat = otherCategories[matchIdx];
        otherCategories.splice(matchIdx, 1);
      }
    }

    const isCatActive = (c) => {
      if (!c) return false;
      const cur = String(state.selectedCategory || '').toLowerCase().trim();
      return (c.name && c.name.toLowerCase().trim() === cur) || 
             (c.id && c.id.toLowerCase().trim() === cur);
    };

    const promotedPill = promotedCat ? `
      <button type="button" class="shop-cat-pill ${isCatActive(promotedCat) ? 'active' : ''}" data-cat="${window.CustomModal.escape(promotedCat.name)}" data-is-promoted="true">
        ${window.CustomModal.escape(promotedCat.name)}
      </button>
    ` : '';

    const allPill = `
      <button type="button" class="shop-cat-pill ${state.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
        All Products
      </button>
    `;

    const catPills = otherCategories.map(c => `
      <button type="button" class="shop-cat-pill ${isCatActive(c) ? 'active' : ''}" data-cat="${window.CustomModal.escape(c.name)}">
        ${window.CustomModal.escape(c.name)}
      </button>
    `).join('');

    bar.innerHTML = promotedPill + allPill + catPills;

    bar.querySelectorAll('.shop-cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat');
        
        // If clicking any other category or 'all', restore buttons to their original positions
        if (state.homePromotedCategory) {
          const isSamePromoted = promotedCat && (
            cat === promotedCat.name || cat === promotedCat.id ||
            String(cat).toLowerCase().trim() === String(promotedCat.name).toLowerCase().trim()
          );
          if (!isSamePromoted) {
            state.homePromotedCategory = null;
          }
        }

        state.selectedCategory = cat;

        // Re-render pills immediately so that if homePromotedCategory was cleared,
        // the promoted button returns to its original position
        renderShopCategoryPills();

        // Sync with modular dropdown picker if available
        if (categoryPickerInstance) {
          categoryPickerInstance.setValue(cat);
        }

        applyFiltersAndSort();
      });
    });

    // If promoted from home, scroll pill container to show the promoted button at the start
    if (promotedCat) {
      try {
        bar.scrollTo({ left: 0, behavior: 'smooth' });
      } catch (_) {
        bar.scrollLeft = 0;
      }
    }
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
              if (state.homePromotedCategory) {
                const targetStr = String(state.homePromotedCategory).toLowerCase().trim();
                const isSame = (val && (
                  val.toLowerCase().trim() === targetStr ||
                  (state.categories || []).some(c => 
                    (c.name.toLowerCase().trim() === targetStr || c.id.toLowerCase().trim() === targetStr) &&
                    (c.name === val || c.id === val)
                  )
                ));
                if (!isSame) state.homePromotedCategory = null;
              }
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
    let prods = [...state.products].filter(p => !window.SupabaseService?.isProductHidden?.(p));

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
        state.homePromotedCategory = null;
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

      const suitFallbackDesc = 'These particular suits are authentic Italian bespoke cuts, crafted with premium high-twist wool blend fabric for exceptional drape, comfort, and structure. Designed with classic notch lapels, flap pockets, soft interior lining, and dual side vents. Meticulously finished for modern executives and high-profile occasions.';
      const rawDesc = prod.description || prod.desc || prod.details || prod.product_description || '';
      const prodDesc = (typeof rawDesc === 'string' && rawDesc.trim().length > 0)
        ? rawDesc.trim()
        : ((prod.title && /suit/i.test(prod.title))
            ? suitFallbackDesc
            : 'Authentic premium quality product curated and verified by Nkem Global Supercenter.');

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
            <p class="product-card-desc">${window.CustomModal.escape(prodDesc)}</p>
            <div class="product-card-list-price">
              <span class="product-card-price">${window.formatNaira(prod.price)}</span>
            </div>
            <div class="product-card-divider"></div>
            <div class="product-card-grid-price">
              <span class="product-card-price">${window.formatNaira(prod.price)}</span>
            </div>
            <div class="product-card-footer">
              <button class="btn btn-add-to-cart" type="button" data-id="${prod.id}" title="Add to Cart">
                ${window.renderIcon('cart')}
                <span>Add to Cart</span>
              </button>
              <a href="https://wa.me/2348155608447?text=${encodeURIComponent(`Hello Nkem Global, I would like to order: ${prod.title} (${window.formatNaira(prod.price)}). Is this available?`)}" target="_blank" rel="noopener" class="btn btn-whatsapp-order" title="Order on WhatsApp" onclick="event.stopPropagation();">
                ${window.renderIcon('whatsapp')}
                <span>Order on WhatsApp</span>
              </a>
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
        if (e.target.closest('.btn-add-to-cart') || e.target.closest('.btn-whatsapp-order')) return;
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
          sort: state.selectedSort,
          includeHidden: false
        });

        if (Array.isArray(nextProducts) && nextProducts.length > 0) {
          const visibleBatch = nextProducts.filter(p => !window.SupabaseService?.isProductHidden?.(p));
          state.products = [...state.products, ...visibleBatch];
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
    let prod = state.products.find(p => p.id === prodId) || state.filteredProducts.find(p => p.id === prodId);
    if (!prod && window.SupabaseService?.getLocalProducts) {
      try {
        const localProds = window.SupabaseService.getLocalProducts(true) || [];
        prod = localProds.find(p => p.id === prodId);
      } catch (_) {}
    }
    if (!prod) {
      const cartItem = getCart().find(i => i.id === prodId || i.product_id === prodId);
      if (cartItem && window.SupabaseService?.getLocalProducts) {
        try {
          const localProds = window.SupabaseService.getLocalProducts(true) || [];
          prod = localProds.find(p => p.title && cartItem.title && p.title.toLowerCase().trim() === cartItem.title.toLowerCase().trim());
        } catch (_) {}
      }
      if (!prod && cartItem) {
        prod = {
          id: cartItem.id || prodId,
          title: cartItem.title,
          price: cartItem.price,
          description: cartItem.description || 'Authentic quality product available for nationwide delivery from Nkem Global.',
          images: cartItem.images || (cartItem.image ? [cartItem.image] : ['assets/images/logo.png']),
          category: cartItem.category || 'General',
          in_stock: true
        };
      }
    }
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
          <div class="details-main-img-box" id="detailsMainImgBox" title="Click to view full image">
            <img class="details-main-img" id="detailsMainImg" src="${currentModalSelectedImage}" alt="${window.CustomModal.escape(prod.title)}" />
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
        </div>
      </div>

      <!-- Floating Docked Action Bar with Solid Boundary Separator -->
      <div class="details-modal-footer">
        <button class="btn btn-primary" type="button" id="detailsAddToCartBtn" ${!prod.in_stock ? 'disabled' : ''}>
          ${window.renderIcon('cart')}
          <span>Add to Cart â€” ${window.formatNaira(prod.price)}</span>
        </button>

        <a href="https://wa.me/2348155608447?text=${encodeURIComponent(`Hello Nkem Global, I would like to order: ${prod.title} (${window.formatNaira(prod.price)}). Is this available?`)}" target="_blank" rel="noopener" class="btn btn-secondary details-whatsapp-btn">
          <span style="color: #25D366; display: inline-flex; align-items: center; font-size: 16px; line-height: 1;">${window.renderIcon('whatsapp')}</span>
          <span>Order on WhatsApp</span>
        </a>
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

    // Move to end of body to ensure it overlays on top of ANY open modal
    document.body.appendChild(fullViewLightbox);

    fullViewLightbox.innerHTML = `
      <div class="full-view-img-container">
        <img class="full-view-img" src="${imgSrc}" alt="" />
      </div>
      <button class="full-view-close-under" type="button" id="fullViewCloseUnderBtn" aria-label="Close View">
        ${window.renderIcon ? window.renderIcon('close') : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
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

  window.openFullViewLightbox = openFullViewLightbox;
  window.openLightbox = openFullViewLightbox;

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
    const activeUser = getActiveUser() || {};
    const isLoggedIn = !!(activeUser && (activeUser.id || activeUser.whatsapp_number));

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
          <!-- Price Summary Breakdown (Pre-Auth) -->
          <div style="background: #ffffff; border: 1.5px solid #d1ead9; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; box-shadow: 0 2px 10px rgba(7, 94, 47, 0.04);">
            <div class="cart-summary-line cart-total-line" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; border: none; padding: 0; margin: 0;">
              <div style="display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 1.02rem; font-weight: 900; color: #065f2c;">Items Total</span>
                <span style="font-size: 0.82rem; font-weight: 700; color: #5a6e62;">(${getCartCount()} ${getCartCount() === 1 ? 'item' : 'items'}):</span>
              </div>
              <strong id="cartGrandTotalText" style="color: #087f3b; font-size: 1.22rem; font-weight: 900; white-space: nowrap; margin-left: auto;">${window.formatNaira(subtotal)}</strong>
            </div>
          </div>

          <!-- Account Required Gate (No Unnecessary Forms) -->
          <div class="cart-auth-gate" style="background: #f0fbf4; border: 1.5px solid #087f3b; border-radius: 12px; padding: 22px 18px; text-align: center;">
            <div class="cart-auth-gate-badge" style="width: 44px; height: 44px; border-radius: 50%; background: #e2f5ea; color: #087f3b; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; font-size: 22px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; color: #087f3b;">
                ${window.renderIcon ? (window.renderIcon('user') || window.renderIcon('account')) : ''}
              </span>
            </div>
            <h4 style="font-size: 1.08rem; font-weight: 900; color: #073b1f; margin-bottom: 6px;">Sign In or Register to Checkout</h4>
            <p style="font-size: 0.84rem; color: #5a6e62; margin-bottom: 18px; line-height: 1.5; max-width: 440px; margin-left: auto; margin-right: auto;">
              An account is required to place your order, confirm delivery to your location, and generate your official receipt with instant tracking.
            </p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary" id="cartPromptSignInBtn" style="padding: 11px 24px; font-size: 0.88rem; font-weight: 800; background-color: #087f3b; border-color: #087f3b; display: inline-flex; align-items: center; gap: 6px;">
                ${window.renderIcon('login')}
                <span>Sign In to Continue</span>
              </button>
              <button type="button" class="btn btn-secondary" id="cartPromptSignUpBtn" style="padding: 11px 24px; font-size: 0.88rem; font-weight: 800; border-color: #087f3b; color: #087f3b; background: #ffffff; display: inline-flex; align-items: center; gap: 6px;">
                ${window.renderIcon('user')}
                <span>Create Free Account</span>
              </button>
            </div>

            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #d1ead9; width: 100%;">
              <button type="button" class="btn btn-cart-whatsapp" id="cartGuestWhatsAppCheckoutBtn">
                ${window.renderIcon('whatsapp')}
                <span>Order on WhatsApp (${window.formatNaira(subtotal)})</span>
              </button>
            </div>
          </div>
        ` : `
          <!-- Verified Account Delivery Details (No Forms To Fill) -->
          <div class="cart-delivery-card" style="background: #f7fbf8; border: 1.5px solid #d1ead9; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #d1ead9; padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px; color: #073b1f; font-weight: 900; font-size: 0.96rem;">
                ${window.renderIcon('truck')}
                <span>Delivery Details & Contact</span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="cartEditProfileBtn" style="padding: 5px 12px; font-size: 0.78rem; font-weight: 700; border-color: #087f3b; color: #087f3b; background: #ffffff; display: inline-flex; align-items: center; gap: 5px;">
                ${window.renderIcon('edit')}
                <span>Change Address</span>
              </button>
            </div>

            ${(activeUser.address && activeUser.state && activeUser.lga) ? `
              <div style="font-size: 0.85rem; color: #1f2937; line-height: 1.6;">
                <div><strong style="color: #073b1f;">Deliver To:</strong> ${window.CustomModal.escape((activeUser.first_name || activeUser.name || 'Valued Customer') + (activeUser.last_name ? ' ' + activeUser.last_name : ''))}</div>
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span style="color: #25D366; display: inline-flex; align-items: center; font-size: 14px; line-height: 1; flex-shrink: 0;">${window.renderIcon('whatsapp')}</span>
                  <strong style="color: #073b1f;">WhatsApp:</strong>
                  <span>${window.CustomModal.escape(activeUser.whatsapp_number || activeUser.phone || '')}</span>
                </div>
                ${activeUser.email ? `
                  <div style="display: flex; align-items: center; gap: 6px; color: #5a6e62; font-size: 0.82rem; word-break: break-all; overflow-wrap: anywhere; margin-top: 3px;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px; flex-shrink: 0; color: #087f3b;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <span style="word-break: break-all; overflow-wrap: anywhere;">${window.CustomModal.escape(activeUser.email)}</span>
                  </div>
                ` : ''}
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #d1ead9;">
                  <strong style="color: #073b1f;">Destination Address:</strong><br />
                  ${window.CustomModal.escape(activeUser.address)}, ${window.CustomModal.escape(activeUser.lga)}, <strong>${window.CustomModal.escape(activeUser.state)} State</strong>
                </div>
              </div>
            ` : `
              <div style="background: #fff8f5; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; font-size: 0.84rem; color: #9a3412;">
                <strong>Delivery address incomplete on your account.</strong><br />
                Please set your delivery address, state, and LGA to proceed with this order.
                <div style="margin-top: 8px;">
                  <button type="button" class="btn btn-primary btn-sm" id="cartSetAddressBtn" style="padding: 6px 14px; font-size: 0.8rem; background-color: #087f3b; border-color: #087f3b;">
                    Set Delivery Address
                  </button>
                </div>
              </div>
            `}
          </div>

          <!-- Price Summary Breakdown -->
          <div style="background: #ffffff; border: 1.5px solid #d1ead9; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; box-shadow: 0 2px 10px rgba(7, 94, 47, 0.04);">
            <div class="cart-summary-line cart-total-line" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; border: none; padding: 0; margin: 0;">
              <div style="display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 1.02rem; font-weight: 900; color: #065f2c;">Grand Total</span>
                <span style="font-size: 0.82rem; font-weight: 700; color: #5a6e62;">(${getCartCount()} ${getCartCount() === 1 ? 'item' : 'items'}):</span>
              </div>
              <strong id="cartGrandTotalText" style="color: #087f3b; font-size: 1.22rem; font-weight: 900; white-space: nowrap; margin-left: auto;">${window.formatNaira(subtotal)}</strong>
            </div>
          </div>

          <!-- Direct One-Click Checkout Button -->
          <button type="button" class="btn btn-primary btn-cart-checkout" id="cartDirectCheckoutBtn">
            ${window.renderIcon('orderNow')}
            <span>Confirm & Place Order (${window.formatNaira(subtotal)})</span>
          </button>

          <!-- Order on WhatsApp Underneath -->
          <button type="button" class="btn btn-cart-whatsapp" id="cartWhatsAppCheckoutBtn">
            ${window.renderIcon('whatsapp')}
            <span>Order on WhatsApp (${window.formatNaira(subtotal)})</span>
          </button>
        `}
      </div>
    `;

    // Handler to compile cart items and open WhatsApp templated chat
    const handleWhatsAppCartOrder = () => {
      const currentCart = getCart();
      if (!currentCart || currentCart.length === 0) {
        if (window.showToast) window.showToast('Your cart is empty', 'warning');
        return;
      }

      let grandTotal = 0;
      let totalQty = 0;
      const itemLines = currentCart.map((item, idx) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const lineTotal = price * qty;
        grandTotal += lineTotal;
        totalQty += qty;
        return `${idx + 1}. *${item.title}* (Qty: ${qty}) â€” ${window.formatNaira(lineTotal)}`;
      });

      let customerDetailsText = '';
      if (activeUser && (activeUser.first_name || activeUser.name || activeUser.address)) {
        const fullName = `${activeUser.first_name || activeUser.name || ''} ${activeUser.last_name || ''}`.trim() || 'Valued Customer';
        const phone = (activeUser.whatsapp_number || activeUser.phone || '').trim();
        const address = (activeUser.address || '').trim();
        const stateName = (activeUser.state || '').trim();
        const lgaName = (activeUser.lga || '').trim();

        customerDetailsText = `\n\n*Customer Delivery Information:*\nâ€¢ Name: ${fullName}`;
        if (phone) customerDetailsText += `\nâ€¢ WhatsApp / Phone: ${phone}`;
        if (address) {
          customerDetailsText += `\nâ€¢ Destination: ${address}${lgaName ? ', ' + lgaName : ''}${stateName ? ', ' + stateName + ' State' : ''}`;
        }
      } else {
        customerDetailsText = `\n\n*Customer Information:*\nâ€¢ Guest Order (I will provide delivery address via this chat)`;
      }

      const orderMessage = `Hello Nkem Global, I would like to order the following items from my cart:\n\n${itemLines.join('\n')}\n\n*Total Items:* ${totalQty}\n*Grand Total:* *${window.formatNaira(grandTotal)}*${customerDetailsText}\n\nPlease confirm availability and payment details. Thank you!`;

      const whatsappUrl = `https://wa.me/2348155608447?text=${encodeURIComponent(orderMessage)}`;
      window.open(whatsappUrl, '_blank');
    };

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

    // Clicking on cart product image, title, or card opens the Product Details modal!
    container.querySelectorAll('.cart-item-card').forEach(card => {
      const itemId = card.getAttribute('data-item-id');
      card.querySelectorAll('.cart-item-thumb, .cart-item-title, .cart-item-info').forEach(clickable => {
        clickable.addEventListener('click', (e) => {
          if (e.target.closest('.cart-item-actions') || e.target.closest('.cart-qty-group') || e.target.closest('.cart-item-remove-btn')) return;
          openProductDetailsModal(itemId);
        });
      });
    });

    // Unauthenticated: Direct triggers to Login / Sign Up / WhatsApp
    if (!isLoggedIn) {
      container.querySelector('#cartPromptSignInBtn')?.addEventListener('click', () => {
        if (window.AuthModal) window.AuthModal.showSignIn(() => renderCartView());
      });
      container.querySelector('#cartPromptSignUpBtn')?.addEventListener('click', () => {
        if (window.AuthModal) window.AuthModal.showSignUp(() => renderCartView());
      });
      container.querySelector('#cartGuestWhatsAppCheckoutBtn')?.addEventListener('click', handleWhatsAppCartOrder);
      return;
    }

    // Authenticated WhatsApp Order Button
    container.querySelector('#cartWhatsAppCheckoutBtn')?.addEventListener('click', handleWhatsAppCartOrder);

    // Authenticated: Address Management
    const openAddressEditor = () => {
      if (window.AuthModal) {
        window.AuthModal.showProfile('profile', () => renderCartView());
      }
    };
    container.querySelector('#cartEditProfileBtn')?.addEventListener('click', openAddressEditor);
    container.querySelector('#cartSetAddressBtn')?.addEventListener('click', openAddressEditor);

    // Authenticated Direct Order Placement
    let isSubmittingCartOrder = false;
    const directCheckoutBtn = container.querySelector('#cartDirectCheckoutBtn');
    if (directCheckoutBtn) {
      directCheckoutBtn.addEventListener('click', async () => {
        if (isSubmittingCartOrder) return;

        const hasCompleteAddress = !!(activeUser.address && activeUser.state && activeUser.lga);
        if (!hasCompleteAddress) {
          window.CustomModal.confirm({
            title: 'Delivery Address Required',
            message: 'Please complete your delivery address and state in your profile so we can deliver your order.',
            confirmText: 'Set Address Now',
            cancelText: 'Cancel',
            onConfirm: openAddressEditor
          });
          return;
        }

        isSubmittingCartOrder = true;
        directCheckoutBtn.disabled = true;
        directCheckoutBtn.style.cursor = 'not-allowed';
        directCheckoutBtn.innerHTML = `
          <span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:6px;"></span>
          <span>Processing Order...</span>
        `;

        const currentCart = getCart();
        if (currentCart.length === 0) return;

        const firstName = activeUser.first_name || (activeUser.name ? activeUser.name.split(' ')[0] : 'Valued');
        const lastName = activeUser.last_name || (activeUser.name ? activeUser.name.split(' ').slice(1).join(' ') : 'Customer');
        const whatsapp = (activeUser.whatsapp_number || activeUser.phone || '').trim();
        const email = (activeUser.email || '').trim() || null;
        const stateName = (activeUser.state || '').trim();
        const lgaName = (activeUser.lga || '').trim();
        const address = (activeUser.address || '').trim();
        const baseTimestamp = Date.now();

        const orderTasks = currentCart.map(async (item, idx) => {
          const qty = Number(item.quantity) || 1;
          const unitPrice = Number(item.price) || 0;
          const itemTotal = unitPrice * qty;
          const orderId = `ord-${baseTimestamp}-${idx + 1}`;
          const retCode = `NKG-${baseTimestamp.toString().slice(-6)}${idx + 1}`;
          const itemImg = item.image || (item.images && item.images[0]) || 'assets/images/logo.png';
          const titleWithQty = qty > 1 ? `${item.title} (Qty: ${qty})` : item.title;

          const orderData = {
            id: orderId,
            retrieval_code: retCode,
            user_id: activeUser.id,
            product_id: item.id || `cart-${idx + 1}`,
            product_title: titleWithQty,
            product_price: itemTotal,
            product_image: itemImg,
            first_name: firstName,
            last_name: lastName,
            whatsapp_number: whatsapp,
            email: email,
            state: stateName,
            lga: lgaName,
            address: address,
            status: 'pending',
            created_at: new Date(baseTimestamp + idx * 1000).toISOString()
          };

          try {
            await window.SupabaseService.createOrder(orderData);

            // Send individual rich Order Card into chat
            if (activeUser.id) {
              const orderChatMessage = {
                id: `msg-ord-${orderData.id}`,
                order_code: orderData.id,
                user_id: activeUser.id,
                user_name: `${firstName} ${lastName}`.trim(),
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
                  email: email,
                  state: stateName,
                  lga: lgaName,
                  address: address,
                  delivery_address: `${address}, ${lgaName}, ${stateName}`,
                  status: 'pending',
                  created_at: orderData.created_at
                },
                message: `Order Placed: ${orderData.product_title} (${window.formatNaira(itemTotal)}) - Status: Pending`,
                image_url: null,
                is_read_by_admin: false,
                is_read_by_user: true,
                deleted_for_everyone: false,
                deleted_for_user: false,
                deleted_for_admin: false,
                created_at: new Date(baseTimestamp + idx * 1000).toISOString()
              };
              await window.SupabaseService.sendUserChatMessage(orderChatMessage).catch(() => {});
            }
          } catch (itemErr) {
            console.error('Error placing individual item order:', itemErr);
          }
          return orderData;
        });

        const createdOrders = await Promise.all(orderTasks);

        // Immediate Cart Clear (Memory, LocalStorage, Cloud, Badges & UI View)
        lastExplicitClearTime = Date.now();
        lastLocalCartMutationTime = Date.now();
        saveCart([], false);
        renderCartView();

        if (activeUser && activeUser.id && window.SupabaseService?.syncUserCartToCloud) {
          await window.SupabaseService.syncUserCartToCloud(activeUser.id, []).catch(() => {});
        }

        isSubmittingCartOrder = false;

        // Open Order Success Modal & Receipt Download
        openOrderSuccessModal(createdOrders);
      });
    }
  }

  /* ==========================================================================
     8. REQUESTS VIEW (Orders & Sourcing Requests Tracking)
     ========================================================================== */
  let requestsFilterStatus = 'all';
  let requestsSortBy = 'newest';
  let requestsFilterPickerInstance = null;
  let requestsSortPickerInstance = null;
  let cachedUserOrders = [];

  function initRequestsPickers() {
    const filterMount = document.getElementById('requestsFilterPickerMount');
    const sortMount = document.getElementById('requestsSortPickerMount');

    if (filterMount && window.CustomPicker && !requestsFilterPickerInstance) {
      requestsFilterPickerInstance = window.CustomPicker.create({
        container: filterMount,
        id: 'requestsStatusFilterPicker',
        title: 'Filter by Status',
        placeholder: 'Filter: All Requests',
        options: [
          { value: 'all', label: 'All Requests' },
          { value: 'pending', label: 'Pending Review' },
          { value: 'approved', label: 'Approved (Confirmed)' },
          { value: 'shipping', label: 'In Transit / Shipping' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'declined', label: 'Declined / Cancelled' }
        ],
        value: requestsFilterStatus,
        searchable: false,
        onChange: (val) => {
          requestsFilterStatus = val;
          renderRequestsView();
        }
      });
    }

    if (sortMount && window.CustomPicker && !requestsSortPickerInstance) {
      requestsSortPickerInstance = window.CustomPicker.create({
        container: sortMount,
        id: 'requestsSortPicker',
        title: 'Sort Requests By',
        placeholder: 'Sort: Newest First',
        options: [
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
          { value: 'price_desc', label: 'Price: High to Low' },
          { value: 'price_asc', label: 'Price: Low to High' },
          { value: 'title_asc', label: 'Item Name (Aâ€“Z)' }
        ],
        value: requestsSortBy,
        searchable: false,
        onChange: (val) => {
          requestsSortBy = val;
          renderRequestsView();
        }
      });
    }
  }

  async function renderRequestsView() {
    const container = document.getElementById('requestsListContainer');
    if (!container) return;

    initRequestsPickers();

    const activeUser = getActiveUser() || {};
    let userPhone = (activeUser.whatsapp_number || activeUser.phone || '').trim();
    let userEmail = (activeUser.email || '').trim();
    let userId = activeUser.id || null;

    let orders = cachedUserOrders.length > 0 ? cachedUserOrders : [];
    if (orders.length === 0 && window.SupabaseService?.getUserOrdersSync) {
      try {
        orders = window.SupabaseService.getUserOrdersSync(userId, userPhone, userEmail) || [];
        if (orders.length > 0) cachedUserOrders = orders;
      } catch (e) {}
    }

    const renderList = (orderItems, isStillLoading = false) => {
      const searchInput = document.getElementById('requestsSearchInput');
      const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

      let filtered = (orderItems || []).filter(o => !window.SupabaseService?.isSourcingOrder || !window.SupabaseService.isSourcingOrder(o)).slice();

      // 1. Text Search Filter
      if (query) {
        filtered = filtered.filter(o => {
          const title = (o.product_title || '').toLowerCase();
          const code = (o.retrieval_code || o.id || '').toLowerCase();
          const dest = (o.address || o.lga || o.state || '').toLowerCase();
          return title.includes(query) || code.includes(query) || dest.includes(query);
        });
      }

      // 2. Status Filter
      if (requestsFilterStatus !== 'all') {
        filtered = filtered.filter(o => {
          const s = (o.status || 'pending').toLowerCase();
          if (requestsFilterStatus === 'shipping') return s === 'shipping' || s === 'shipped';
          if (requestsFilterStatus === 'declined') return s === 'declined' || s === 'cancelled';
          return s === requestsFilterStatus;
        });
      }

      // 3. Sorting
      filtered.sort((a, b) => {
        if (requestsSortBy === 'newest') {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
        if (requestsSortBy === 'oldest') {
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        }
        if (requestsSortBy === 'price_desc') {
          return (Number(b.product_price) || 0) - (Number(a.product_price) || 0);
        }
        if (requestsSortBy === 'price_asc') {
          return (Number(a.product_price) || 0) - (Number(b.product_price) || 0);
        }
        if (requestsSortBy === 'title_asc') {
          return String(a.product_title || '').localeCompare(String(b.product_title || ''));
        }
        return 0;
      });

      if (filtered.length === 0) {
        if (isStillLoading) {
          container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #5a6e62;">
              <span class="spinner" style="display:inline-block; width:26px; height:26px; border:2.5px solid #087f3b; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-bottom:10px;"></span>
              <div style="font-size: 0.92rem; font-weight: 600;">Loading your orders and sourcing requests...</div>
            </div>
          `;
          return;
        }

        const isFiltered = !!(query || requestsFilterStatus !== 'all');
        container.innerHTML = `
          <div class="cart-empty-state">
            <div class="cart-empty-icon">${window.renderIcon('requests')}</div>
            <h3 class="cart-empty-title">${isFiltered ? 'No Matching Requests Found' : 'No Orders or Requests Found'}</h3>
            <p class="cart-empty-sub">${isFiltered ? 'No orders match your search query or selected status filter.' : 'When you place orders or submit sourcing requests via "Everything Dey", they will appear here with live tracking.'}</p>
            ${isFiltered ? `
              <button class="btn btn-secondary" type="button" id="reqResetFilterBtn" style="padding: 10px 22px; font-weight: 700; border-color: #087f3b; color: #087f3b;">
                Reset Filter & Search
              </button>
            ` : `
              <button class="btn btn-primary" type="button" id="reqStartShoppingBtn" style="padding: 12px 28px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;">
                ${window.renderIcon('shop')}
                <span>Start Shopping Now</span>
              </button>
            `}
          </div>
        `;
        if (isFiltered) {
          container.querySelector('#reqResetFilterBtn')?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            requestsFilterStatus = 'all';
            requestsSortBy = 'newest';
            if (requestsFilterPickerInstance?.setValue) requestsFilterPickerInstance.setValue('all');
            if (requestsSortPickerInstance?.setValue) requestsSortPickerInstance.setValue('newest');
            renderRequestsView();
          });
        } else {
          container.querySelector('#reqStartShoppingBtn')?.addEventListener('click', () => {
            window.switchAppTab('shop');
          });
        }
        return;
      }

      container.innerHTML = filtered.map(o => {
        const status = (o.status || 'pending').toLowerCase();
        const code = o.retrieval_code || o.id || '';
        const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
        const prodImg = window.resolveProductImage ? window.resolveProductImage(o) : (o.product_image || 'assets/images/logo.png');
        const productTitle = o.product_title || 'Custom Order';

        return `
          <div class="requests-card">
            <div class="request-card-top">
              <div style="flex: 1; min-width: 0; padding-right: 8px;">
                <h4 class="request-card-title">${window.CustomModal.escape(productTitle)}</h4>
                <div style="font-size: 0.78rem; color: #5a6e62; margin-top: 2px;">Placed on ${dateStr}</div>
              </div>
              <span class="request-status-pill ${status}">${status}</span>
            </div>

            <div style="display: flex; gap: 14px; align-items: flex-start; margin: 10px 0;">
              <img src="${prodImg}" alt="${window.CustomModal.escape(productTitle)}" class="request-card-thumb" onerror="this.src='assets/images/logo.png';" />
              <div style="flex: 1; min-width: 0;">
                <div class="request-card-info" style="margin-bottom: 0;">
                  <div><strong>Code:</strong> <span class="request-code-badge">${code}</span></div>
                  <div><strong>Amount:</strong> <span style="color: #087f3b; font-weight: 800;">${Number(o.product_price) > 0 ? window.formatNaira(o.product_price) : 'Quote Pending'}</span></div>
                  ${(o.state || o.address) ? `<div><strong>Destination:</strong> ${window.CustomModal.escape([o.address, o.lga, o.state ? o.state + ' State' : ''].filter(Boolean).join(', '))}</div>` : ''}
                </div>
              </div>
            </div>

            <div class="request-card-actions">
              ${Number(o.product_price) > 0 ? `
                <button type="button" class="btn btn-secondary btn-sm req-download-btn" data-id="${o.id}" style="padding: 6px 12px; font-size: 0.78rem;">
                  ${window.renderIcon('download')}
                  <span>Download Receipt</span>
                </button>
              ` : ''}
              <a href="https://wa.me/2348155608447?text=${encodeURIComponent(`Hello Nkem Global, I am inquiring about my request (${code}): ${productTitle}`)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="padding: 6px 12px; font-size: 0.78rem; color: #166534; border-color: #25D366; text-decoration: none;">
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
    };

    // Initial render with sync cached data
    if (orders.length > 0) {
      renderList(orders, false);
    } else {
      renderList([], true); // Shows loading spinner
    }

    // Always fetch fresh orders from Supabase cloud database
    try {
      if (window.SupabaseService?.getUserOrders) {
        const fresh = await window.SupabaseService.getUserOrders(userId, userPhone, userEmail, 3000);
        if (fresh && Array.isArray(fresh)) {
          cachedUserOrders = fresh;
          renderList(fresh, false);
        }
      }
    } catch (e) {
      renderList(orders, false);
    }
  }

  /* ==========================================================================
     9. ACCOUNT VIEW (Profile, Live Chat, WhatsApp & Support)
     ========================================================================== */
  function renderAccountView() {
    const container = document.getElementById('accountContentContainer');
    if (!container) return;

    const activeUser = getActiveUser();
    const isLoggedIn = !!(activeUser && (activeUser.id || activeUser.whatsapp_number));
    const fullName = isLoggedIn ? [activeUser.first_name, activeUser.last_name].filter(Boolean).join(' ') || activeUser.name || 'Valued Customer' : 'Welcome to Nkem Global';
    const avatarInitial = isLoggedIn ? (activeUser.first_name ? activeUser.first_name.charAt(0).toUpperCase() : (activeUser.name ? activeUser.name.charAt(0).toUpperCase() : 'U')) : '';
    const phone = isLoggedIn ? (activeUser.whatsapp_number || activeUser.phone || '') : '';
    const email = isLoggedIn ? (activeUser.email || '') : '';
    const state = isLoggedIn ? (activeUser.state || '') : '';
    const lga = isLoggedIn ? (activeUser.lga || '') : '';
    const address = isLoggedIn ? (activeUser.address || '') : '';
    const orders = window.SupabaseService.getLocalOrders ? window.SupabaseService.getLocalOrders() : [];

    container.innerHTML = `
      <div class="account-card-box">
        <div class="account-profile-header">
          <div class="account-avatar-circle" style="background: #087f3b; color: #ffffff; font-weight: 800; font-size: 1.4rem; display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%;">
            ${isLoggedIn ? avatarInitial : window.renderIcon('account')}
          </div>
          <div style="flex: 1; min-width: 0; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 class="account-user-name" style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #073b1f; word-break: break-word;">
                ${window.CustomModal.escape(fullName)}
              </h3>
              ${isLoggedIn ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; font-weight: 700; color: #087f3b; background: #e8f7ee; padding: 2px 8px; border-radius: 999px; border: 1px solid #c2e8d0; flex-shrink: 0;">Verified Customer</span>` : ''}
            </div>
            <div class="account-user-phone" style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem;">
              ${isLoggedIn ? `
                <div style="display: flex; align-items: center; gap: 6px; color: #166534; font-weight: 600;">
                  <span style="color: #25D366; display: inline-flex; align-items: center; font-size: 14px; line-height: 1; flex-shrink: 0;">${window.renderIcon('whatsapp')}</span>
                  <span>${window.CustomModal.escape(phone)}</span>
                </div>
                ${email ? `
                  <div style="display: flex; align-items: center; gap: 6px; color: #5a6e62; font-weight: 500; font-size: 0.78rem; word-break: break-all; overflow-wrap: anywhere; max-width: 100%; min-width: 0; overflow: hidden;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px; flex-shrink: 0; color: #087f3b;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <span style="word-break: break-all; overflow-wrap: anywhere; min-width: 0; max-width: 100%; display: inline-block;">${window.CustomModal.escape(email)}</span>
                  </div>
                ` : ''}
              ` : 'Sign in to track orders, manage your profile and chat.'}
            </div>
          </div>
        </div>

        ${isLoggedIn ? `
          <div style="background: #f7fbf8; border: 1px solid #d1ead9; border-radius: 10px; padding: 12px 14px; margin: 12px 0; display: flex; justify-content: space-around; text-align: center;">
            <div style="cursor: pointer;" id="accountOrdersStatBox">
              <div style="font-size: 1.25rem; font-weight: 900; color: #087f3b;">${orders.length}</div>
              <div style="font-size: 0.74rem; color: #5a6e62; font-weight: 700;">Orders / Requests</div>
            </div>
            <div style="border-left: 1px solid #d1ead9;"></div>
            <div>
              <div style="font-size: 1.25rem; font-weight: 900; color: #087f3b;">${state || 'NG'}</div>
              <div style="font-size: 0.74rem; color: #5a6e62; font-weight: 700;">Delivery State</div>
            </div>
          </div>

          <div style="background: #f7fbf8; border: 1px solid #d1ead9; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; font-size: 0.84rem; color: #1f2937;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <strong style="color: #073b1f;">Default Delivery Address:</strong>
              <button type="button" id="accountQuickEditAddrBtn" style="background: none; border: none; color: #087f3b; font-size: 0.78rem; font-weight: 700; cursor: pointer; text-decoration: underline; padding: 0;">Edit</button>
            </div>
            <div>${window.CustomModal.escape(address || 'No street address set yet')}, ${window.CustomModal.escape(lga || '')}, <strong>${window.CustomModal.escape(state || 'NG')} State</strong></div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="accountEditProfileBtn" style="flex: 1 1 calc(50% - 4px); justify-content: center; padding: 9px 10px; font-size: 0.8rem;">
              ${window.renderIcon('edit')}
              <span>Edit Profile &amp; Address</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="accountChangePassBtn" style="flex: 1 1 calc(50% - 4px); justify-content: center; padding: 9px 10px; font-size: 0.8rem;">
              <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Change Password</span>
            </button>
            <a href="chat.html" class="btn btn-secondary btn-sm" id="accountDirectChatBtn" style="flex: 1 1 100%; justify-content: center; padding: 11px 14px; font-size: 0.86rem; font-weight: 800; background: #eaf7f0; color: #075b2a; border: 1.5px solid #087f3b; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;">
              <span style="display: inline-flex; align-items: center; color: #087f3b; flex-shrink: 0;">${window.renderIcon('chat')}</span>
              <span>Open Live Support Chat</span>
              <span class="account-chat-indicator" id="accountChatIndicator" style="display: none; background: #dc2626; color: #ffffff; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 999px; line-height: 1.2; margin-left: 6px; align-items: center; gap: 4px;">
                <span id="accountChatBadgeText">0</span> New
              </span>
            </a>
            <button type="button" class="btn btn-primary btn-sm" id="accountTrackOrdersBtn" style="flex: 1 1 100%; justify-content: center; padding: 10px; font-size: 0.82rem; font-weight: 700; background-color: #087f3b; border-color: #087f3b;">
              <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>View My Orders &amp; Tracking (${orders.length})</span>
            </button>
            <button type="button" class="btn btn-danger btn-sm" id="accountLogoutBtn" style="flex: 1 1 100%; justify-content: center; padding: 9px 10px; font-size: 0.8rem;">
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
          <div class="support-left" style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #087f3b; display: inline-flex; align-items: center;">${window.renderIcon('chat')}</span>
            <span>Live Support Chat</span>
            <span id="accountSupportChannelBadge" style="display: none; background: #dc2626; color: #ffffff; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 999px; line-height: 1.2; margin-left: 6px;">0 New</span>
          </div>
          <span class="support-action-link">
            <span>Open Chat</span>
            <svg class="support-chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>

        <a href="https://wa.me/2347042087633?text=Hello%20Nkem%20Global%2C%20I%20am%20inquiring%20about%20my%20account" target="_blank" rel="noopener" class="account-support-btn">
          <div class="support-left">
            <span style="color: #25D366;">${window.renderIcon('whatsapp')}</span>
            <span>WhatsApp Business Desk (+234 704 208 7633)</span>
          </div>
          <span class="support-action-link">
            <span>Chat</span>
            <svg class="support-chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>

        <a href="tel:+2348155608447" class="account-support-btn">
          <div class="support-left">
            <span style="color: #087f3b;">${window.renderIcon('phone')}</span>
            <span>Direct Enquiries Line (+234 815 560 8447)</span>
          </div>
          <span class="support-action-link">
            <span>Call</span>
            <svg class="support-chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>

        <a href="mailto:info@nkemmarket.com" class="account-support-btn">
          <div class="support-left">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="#087f3b" stroke-width="2" style="width: 17px; height: 17px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span>Official Email (info@nkemmarket.com)</span>
          </div>
          <span class="support-action-link">
            <span>Email</span>
            <svg class="support-chevron-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </a>
      </div>

      <!-- Corporate Accreditation & CAC Verification Card -->
      <div class="account-card-box" style="border-left: 4px solid #087f3b;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 6px;">
          <h4 style="color: #073b1f; font-size: 1.05rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="#087f3b" stroke-width="2.2" style="width: 20px; height: 20px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Corporate Governance &amp; CAC Profile</span>
          </h4>
          <span style="font-size: 0.72rem; font-weight: 800; color: #087f3b; background: #e8f7ee; padding: 3px 9px; border-radius: 999px; border: 1px solid #c2e8d0;">
            CAC Verified Entity
          </span>
        </div>

        <p style="font-size: 0.82rem; color: #4b5563; line-height: 1.5; margin-bottom: 12px;">
          <strong>NKEM GLOBAL SERVICES LIMITED (NGS)</strong> is an indigenous Nigerian enterprise fully registered under the Corporate Affairs Commission (CAC).
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin-bottom: 14px;">
          <div style="background: #f9fbf9; border: 1px solid #e2ece5; border-radius: 8px; padding: 10px 12px; font-size: 0.8rem;">
            <div style="color: #6b7280; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Statutory Authority</div>
            <strong style="color: #073b1f;">Corporate Affairs Commission (CAC)</strong>
            <div style="color: #087f3b; font-weight: 600; margin-top: 2px;">Fully Registered Indigenous Enterprise</div>
          </div>

          <div style="background: #f9fbf9; border: 1px solid #e2ece5; border-radius: 8px; padding: 10px 12px; font-size: 0.8rem;">
            <div style="color: #6b7280; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Executive Leadership</div>
            <strong style="color: #073b1f;">Raphael Nkemjika Julius</strong>
            <div style="color: #4b5563; margin-top: 2px;">Managing Director</div>
          </div>

          <div style="background: #f9fbf9; border: 1px solid #e2ece5; border-radius: 8px; padding: 10px 12px; font-size: 0.8rem;">
            <div style="color: #6b7280; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Tax &amp; Safety Compliance</div>
            <strong style="color: #073b1f;">FIRS (TIN &amp; VAT) &bull; NSITF</strong>
            <div style="color: #4b5563; margin-top: 2px;">100% Nigerian Content (NOGICD)</div>
          </div>

          <div style="background: #f9fbf9; border: 1px solid #e2ece5; border-radius: 8px; padding: 10px 12px; font-size: 0.8rem;">
            <div style="color: #6b7280; font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Operational Base</div>
            <strong style="color: #073b1f;">Oyigbo, Rivers State</strong>
            <div style="color: #4b5563; margin-top: 2px;">No. 5, Chief Owna St, Obeama</div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <a href="https://nkemmarket.com" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="flex: 1; min-width: 140px; justify-content: center; font-size: 0.78rem; padding: 8px 12px; text-decoration: none;">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span>Visit Corporate Website</span>
          </a>
          <a href="mailto:info@nkemmarket.com" class="btn btn-secondary btn-sm" style="flex: 1; min-width: 140px; justify-content: center; font-size: 0.78rem; padding: 8px 12px; text-decoration: none;">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span>Send Formal RFQ / Inquiry</span>
          </a>
        </div>
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
        window.AuthModal.showProfile('profile', () => renderAccountView());
      }
    });
    container.querySelector('#accountQuickEditAddrBtn')?.addEventListener('click', () => {
      if (window.AuthModal) {
        window.AuthModal.showProfile('profile', () => renderAccountView());
      }
    });
    container.querySelector('#accountChangePassBtn')?.addEventListener('click', () => {
      if (window.AuthModal) {
        window.AuthModal.showProfile('security', () => renderAccountView());
      }
    });
    container.querySelector('#accountTrackOrdersBtn')?.addEventListener('click', () => {
      window.switchAppTab('requests');
    });
    container.querySelector('#accountOrdersStatBox')?.addEventListener('click', () => {
      window.switchAppTab('requests');
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

    // Check and populate unread messages indicator immediately
    checkUnreadMessages();
  }

  /* ==========================================================================
     10. ORDER CONFIRMATION MODAL & RECEIPT DOWNLOAD
     ========================================================================== */
  function openOrderSuccessModal(ordersInput) {
    if (!orderSuccessModal) return;
    const orders = Array.isArray(ordersInput) ? ordersInput : [ordersInput];
    if (orders.length === 0) return;
    const firstOrder = orders[0];
    const isMulti = orders.length > 1;
    const totalOrderAmount = orders.reduce((sum, o) => sum + (Number(o.product_price) || 0), 0);

    orderSuccessModal.innerHTML = `
      <div class="c-modal-box" style="max-width: 520px; max-height: 90vh; max-height: 90dvh; display: flex; flex-direction: column;">
        <div class="c-modal-header" style="flex-shrink: 0;">
          <div class="c-modal-title-wrap">
            <h3 class="c-modal-title" style="color: #087f3b;">${isMulti ? `${orders.length} Order Requests Received!` : 'Order Request Received!'}</h3>
          </div>
          <button class="c-modal-close-btn" type="button" id="closeSuccessModalBtn">
            ${window.renderIcon('close')}
          </button>
        </div>

        <div class="c-modal-body receipt-modal-box" style="overflow-y: auto; -webkit-overflow-scrolling: touch; flex: 1 1 auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; text-align: left;">
          <p class="c-modal-text" style="margin: 0; font-size: 0.88rem; color: #2d3748; flex-shrink: 0; line-height: 1.45;">
            Thank you, <strong>${window.CustomModal.escape(firstOrder.first_name)} ${window.CustomModal.escape(firstOrder.last_name)}</strong>! Your ${isMulti ? `<strong>${orders.length} orders</strong> have` : 'order has'} been recorded and sent to our admin team.
          </p>

          <div class="success-order-items-list" style="display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; min-height: fit-content; margin: 4px 0;">
            ${orders.map((ord, i) => `
              <div class="success-order-item-card" style="background: #f7fbf8; border: 1.5px solid #d1ead9; border-radius: 12px; padding: 12px 14px; text-align: left; display: flex; gap: 12px; align-items: center; flex-shrink: 0; min-height: 78px; box-sizing: border-box;">
                <img src="${ord.product_image || 'assets/images/logo.png'}" alt="Item" style="width: 58px; height: 58px; min-width: 58px; border-radius: 8px; object-fit: cover; border: 1.5px solid #d1ead9; background: #ffffff; flex-shrink: 0;" onerror="this.src='assets/images/logo.png';" />
                <div style="flex: 1; min-width: 0;">
                  <div style="color: #073b1f; font-weight: 800; font-size: 0.92rem; line-height: 1.35; margin-bottom: 3px; word-break: break-word;">${window.CustomModal.escape(ord.product_title)}</div>
                  <div style="color: #087f3b; font-weight: 800; font-size: 0.95rem; margin-bottom: 4px;">${window.formatNaira(ord.product_price)}</div>
                  <div style="font-size: 0.76rem; color: #5a6e62;">Code: <span style="font-family: monospace; font-weight: 700; background: #e8f7ee; padding: 2px 6px; border-radius: 4px; color: #064e26; border: 1px solid #c2e8d0;">${ord.retrieval_code || ord.id}</span></div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm req-mini-download-btn" data-index="${i}" title="Download Receipt" style="padding: 8px 10px; font-size: 0.78rem; flex-shrink: 0;">
                  ${window.renderIcon('download')}
                </button>
              </div>
            `).join('')}
          </div>

          <div style="background: #e8f7ee; border: 1px solid #c2e8d0; border-radius: 10px; padding: 10px 14px; font-size: 0.86rem; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <span style="font-weight: 700; color: #073b1f;">Total Order Value:</span>
            <span style="color: #087f3b; font-weight: 900; font-size: 1.15rem;">${window.formatNaira(totalOrderAmount)}</span>
          </div>

          <div class="code-actions-row" style="flex-shrink: 0;">
            <button class="btn btn-primary" type="button" id="downloadReceiptImgBtn" style="width: 100%; justify-content: center; padding: 12px; font-weight: 800; background-color: #087f3b; border-color: #087f3b;">
              ${window.renderIcon('download')}
              <span>Download Official Receipt${isMulti ? 's' : ''}</span>
            </button>
          </div>

          <p style="font-size: 0.78rem; color: #5a6e62; margin: 0; flex-shrink: 0; line-height: 1.4;">
            Official receipts carry Nkem Global brand details, shop contact info, and retrieval codes for instant tracking.
          </p>

          <div style="padding-top: 10px; border-top: 1px solid #d1ead9; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center; background-color: #065f2c; border-color: #065f2c; padding: 11px;" type="button" id="trackInOrdersBtn">
              <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Track in Requests Tab</span>
            </button>
            <a href="chat.html" class="btn btn-secondary" style="width: 100%; justify-content: center; text-decoration: none; padding: 11px;" id="orderSuccessChatBtn">
              ${window.renderIcon('chat')}
              <span>Open Direct Chat with Support</span>
            </a>
            <button class="btn btn-secondary" style="width: 100%; justify-content: center; padding: 11px;" type="button" id="closeSuccessBtn">
              <span>Continue Shopping</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Download handlers
    orderSuccessModal.querySelectorAll('.req-mini-download-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-index'));
        if (orders[idx]) {
          window.CustomModal.toast({ message: 'Generating receipt...', type: 'info' });
          await window.ReceiptGenerator.downloadReceiptImage(orders[idx]);
          window.CustomModal.toast({ message: 'Receipt downloaded!', type: 'success' });
        }
      });
    });

    orderSuccessModal.querySelector('#downloadReceiptImgBtn')?.addEventListener('click', async () => {
      window.CustomModal.toast({ message: `Generating receipt${isMulti ? 's' : ''}...`, type: 'info' });
      for (const ord of orders) {
        await window.ReceiptGenerator.downloadReceiptImage(ord);
      }
      window.CustomModal.toast({ message: 'Receipt download ready!', type: 'success' });
    });

    const closeSuccess = () => orderSuccessModal.classList.remove('active');
    orderSuccessModal.querySelector('#closeSuccessModalBtn')?.addEventListener('click', () => {
      closeSuccess();
      window.switchAppTab('shop');
    });
    orderSuccessModal.querySelector('#closeSuccessBtn')?.addEventListener('click', () => {
      closeSuccess();
      window.switchAppTab('shop');
    });

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
      const activeUser = getActiveUser();
      if (!activeUser || !activeUser.id) {
        const ids = ['accountChatIndicator', 'accountSupportChannelBadge', 'bottomChatCount', 'deskChatBadge'];
        ids.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
        const deskAccountBtn = document.getElementById('deskAccountNavBtn');
        if (deskAccountBtn) deskAccountBtn.textContent = 'Account';
        return;
      }

      const count = await window.SupabaseService.getUnreadCountForUser(activeUser.id);

      // 1. Account View Direct Chat Button Indicator
      const chatIndicator = document.getElementById('accountChatIndicator');
      const chatBadgeText = document.getElementById('accountChatBadgeText');
      if (chatIndicator) {
        if (count > 0) {
          if (chatBadgeText) chatBadgeText.textContent = count;
          chatIndicator.style.display = 'inline-flex';
        } else {
          chatIndicator.style.display = 'none';
        }
      }

      // 2. Account View Support Channel Card Indicator
      const channelBadge = document.getElementById('accountSupportChannelBadge');
      if (channelBadge) {
        if (count > 0) {
          channelBadge.textContent = `${count} New`;
          channelBadge.style.display = 'inline-flex';
        } else {
          channelBadge.style.display = 'none';
        }
      }

      // 3. Mobile Bottom Navigation "Account" Tab Indicator Bubble
      const bottomCount = document.getElementById('bottomChatCount');
      if (bottomCount) {
        if (count > 0) {
          bottomCount.textContent = count > 99 ? '99+' : String(count);
          bottomCount.style.display = 'flex';
        } else {
          bottomCount.style.display = 'none';
        }
      }

      // 4. Desktop Navigation "Account" Tab
      const deskAccountBtn = document.getElementById('deskAccountNavBtn');
      if (deskAccountBtn) {
        const dName = activeUser.first_name || (activeUser.name ? activeUser.name.split(' ')[0] : 'Account');
        const deskBadge = document.getElementById('deskChatBadge');
        if (deskBadge) {
          deskBadge.textContent = count;
          deskBadge.style.display = count > 0 ? 'inline-block' : 'none';
        } else {
          deskAccountBtn.innerHTML = `
            <span>${window.CustomModal.escape(dName)}</span>
            <span class="desktop-nav-badge" id="deskChatBadge" style="${count > 0 ? 'display: inline-block;' : 'display: none;'} background: #dc2626; color: #ffffff; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 0.72rem; font-weight: 800;">
              ${count}
            </span>
          `;
        }
      }
    } catch (e) {
      console.warn('Error checking unread messages:', e);
    }
  }

  // Poll for incoming chat messages every 10 seconds for real-time notification
  if (!window._chatUnreadPollInterval) {
    window._chatUnreadPollInterval = setInterval(() => {
      if (typeof checkUnreadMessages === 'function') checkUnreadMessages();
    }, 10000);
  }

  // Multi-device real-time cart sync polling (relaxed interval to prevent cellular flapping)
  if (!window._cartCloudSyncInterval) {
    window._cartCloudSyncInterval = setInterval(() => {
      if (typeof syncCartWithCloud === 'function') syncCartWithCloud(false);
    }, 25000);
  }

  window.addEventListener('online', () => {
    if (typeof syncCartWithCloud === 'function') syncCartWithCloud(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (typeof syncCartWithCloud === 'function') syncCartWithCloud(false);
      if (typeof checkUnreadMessages === 'function') checkUnreadMessages();
    }
  });

  window.addEventListener('focus', () => {
    if (typeof syncCartWithCloud === 'function') syncCartWithCloud(false);
    if (typeof checkUnreadMessages === 'function') checkUnreadMessages();
  });

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

  // Listen for user profile updates to instantly re-sync cart & account views
  window.addEventListener('user-profile-updated', () => {
    if (state.currentTab === 'cart') {
      renderCartView();
    } else if (state.currentTab === 'account') {
      renderAccountView();
    }
  });

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
