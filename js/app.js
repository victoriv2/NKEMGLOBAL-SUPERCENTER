// Public Storefront Engine - Nkem Global
// Enforces Zero Emojis, Zero Shadows/Glows/Gradients, Zero Hover Lifts, Custom Pickers & Modals, Click-to-Swipe Banner

document.addEventListener('DOMContentLoaded', async () => {
  // App State
  const state = {
    banners: [],
    categories: [],
    products: [],
    filteredProducts: [],
    selectedCategory: 'all',
    selectedSort: 'newest',
    pageSize: 16,
    hasMoreProducts: false,
    isLoadingMore: false,
    currentBannerIndex: 0,
    bannerTimer: null,
    productCardTimers: {},
    activeProductForOrder: null,
    currentView: localStorage.getItem('nkem_product_view') || 'grid'
  };

  // DOM Elements
  const bannerCarousel = document.getElementById('bannerCarousel');
  const bannerTrack = document.getElementById('bannerTrack');
  const bannerIndicators = document.getElementById('bannerIndicators');
  const bannerCaption = document.getElementById('bannerCaption');
  const bannerPrevBtn = document.getElementById('bannerPrevBtn');
  const bannerNextBtn = document.getElementById('bannerNextBtn');
  const productGrid = document.getElementById('productGrid');
  const seeMoreContainer = document.getElementById('seeMoreContainer');
  const seeMoreBtn = document.getElementById('seeMoreBtn');
  const categoryPickerMount = document.getElementById('categoryPickerMount');
  const sortPickerMount = document.getElementById('sortPickerMount');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const headerAuthContainer = document.getElementById('headerAuthContainer');
  const mobileAuthContainer = document.getElementById('mobileAuthContainer');
  const navChatBadge = document.getElementById('navChatBadge');
  const mobChatBadge = document.getElementById('mobChatBadge');

  // Modals
  const detailsModalOverlay = document.getElementById('productDetailsModal');
  const fullViewLightbox = document.getElementById('fullViewLightbox');
  const orderChoiceModal = document.getElementById('orderChoiceModal');
  const onlineOrderModal = document.getElementById('onlineOrderModal');
  const orderSuccessModal = document.getElementById('orderSuccessModal');

  /* ==========================================================================
     1. INITIAL DATA FETCHING (Supabase with Local Fallback)
     ========================================================================== */
  async function loadInitialData() {
    // 0ms INSTANT RENDER FROM LOCAL CACHE:
    // Display banners, categories, and catalog in 0ms so page never sits empty or waits for slow network
    try {
      const cachedBanners = window.SupabaseService.getLocalBanners ? window.SupabaseService.getLocalBanners() : [];
      const cachedCategories = window.SupabaseService.getLocalCategories ? window.SupabaseService.getLocalCategories() : [];
      const cachedProducts = window.SupabaseService.getLocalProducts ? window.SupabaseService.getLocalProducts() : [];

      if (cachedBanners.length > 0) state.banners = cachedBanners;
      if (cachedCategories.length > 0) state.categories = cachedCategories;
      if (cachedProducts.length > 0) state.products = cachedProducts;

      if (state.banners.length > 0 || state.products.length > 0) {
        initBanners();
        initToolbars();
        initSeeMore();
        applyFiltersAndSort();
        renderUserAuthHeader();
        checkUnreadMessages();
      }
    } catch (e) {
      console.warn('Local cache preload notice:', e);
    }

    try {
      const [banners, categories, products] = await Promise.all([
        window.SupabaseService.getBanners(),
        window.SupabaseService.getCategories(),
        window.SupabaseService.getProducts({
          limit: state.pageSize,
          offset: 0,
          categoryId: state.selectedCategory,
          sort: state.selectedSort
        })
      ]);

      if (banners && banners.length > 0) state.banners = banners;
      if (categories && categories.length > 0) state.categories = categories;
      if (products && products.length > 0) state.products = products;
      state.hasMoreProducts = Array.isArray(products) && products.length === state.pageSize;

      initBanners();
      initToolbars();
      initSeeMore();
      applyFiltersAndSort();
      renderUserAuthHeader();
      checkUnreadMessages();

      // Free-tier bandwidth protection: poll unread badge every 15s ONLY if tab is active and user is logged in
      setInterval(() => {
        if (!document.hidden && window.SupabaseService.getCurrentUser()) {
          checkUnreadMessages();
        }
      }, 15000);

      // Instantly refresh when returning to tab
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && window.SupabaseService.getCurrentUser()) {
          checkUnreadMessages();
        }
      });
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }

  // Reactive updates on sign-in / sign-out
  window.addEventListener('nkem_auth_changed', () => {
    renderUserAuthHeader();
    checkUnreadMessages();
  });

  /* ==========================================================================
     2. HERO BANNER SLIDER (Logo Banners, Click/Drag to Swipe, 2s Auto-Slide)
     ========================================================================== */
  function initBanners() {
    if (!state.banners || state.banners.length === 0) {
      // Fallback logo banners if empty
      state.banners = [
        {
          id: 'banner-1',
          image_url: 'assets/images/logo.jpeg',
          caption: 'Welcome to Nkem Global — Quality Products & Express Nationwide Delivery',
          sort_order: 1
        },
        {
          id: 'banner-2',
          image_url: 'assets/images/logo.jpeg',
          caption: 'Direct Orders & Customer Inquiries via WhatsApp & Online Portal',
          sort_order: 2
        }
      ];
    }

    bannerTrack.innerHTML = state.banners.map((b, idx) => `
      <div class="banner-slide" data-idx="${idx}">
        <img class="banner-img" src="${b.image_url}" alt="Nkem Global Banner ${idx + 1}" draggable="false" />
      </div>
    `).join('');

    bannerIndicators.innerHTML = state.banners.map((_, idx) => `
      <div class="banner-dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}"></div>
    `).join('');

    bannerIndicators.querySelectorAll('.banner-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        goToBanner(parseInt(dot.getAttribute('data-idx'), 10));
        resetBannerTimer();
      });
    });

    if (bannerPrevBtn) {
      bannerPrevBtn.addEventListener('click', () => {
        prevBanner();
        resetBannerTimer();
      });
    }

    if (bannerNextBtn) {
      bannerNextBtn.addEventListener('click', () => {
        nextBanner();
        resetBannerTimer();
      });
    }

    // DESKTOP & MOBILE CLICK-TO-SWIPE (No hover to swipe)
    initBannerSwipeGestures();

    updateBannerUI();
    startBannerTimer();
  }

  function initBannerSwipeGestures() {
    if (!bannerCarousel) return;

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isSwiping = false;

    // Touch events only (Mobile & Tablet Touch Gestures - mouse users use arrow buttons / dots)
    bannerCarousel.addEventListener('touchstart', (e) => {
      if (e.target.closest('.banner-arrow-btn') || e.target.closest('.banner-indicators')) return;
      if (e.touches && e.touches.length > 0) {
        isSwiping = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = startX;
        currentY = startY;
      }
    }, { passive: true });

    bannerCarousel.addEventListener('touchmove', (e) => {
      if (!isSwiping || !e.touches || e.touches.length === 0) return;
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
    }, { passive: true });

    bannerCarousel.addEventListener('touchend', () => {
      if (!isSwiping) return;
      isSwiping = false;
      const diffX = currentX - startX;
      const diffY = currentY - startY;

      // Ensure horizontal swipe is distinct and greater than vertical movement
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          nextBanner();
        } else {
          prevBanner();
        }
        resetBannerTimer();
      }
    }, { passive: true });
  }

  function goToBanner(index) {
    if (state.banners.length === 0) return;
    if (index >= state.banners.length) {
      state.currentBannerIndex = 0; // Loop back to start
    } else if (index < 0) {
      state.currentBannerIndex = state.banners.length - 1;
    } else {
      state.currentBannerIndex = index;
    }
    updateBannerUI();
  }

  function nextBanner() {
    goToBanner(state.currentBannerIndex + 1);
  }

  function prevBanner() {
    goToBanner(state.currentBannerIndex - 1);
  }

  function updateBannerUI() {
    bannerTrack.style.transform = `translateX(-${state.currentBannerIndex * 100}%)`;
    
    // Update Indicators
    bannerIndicators.querySelectorAll('.banner-dot').forEach((dot, idx) => {
      dot.classList.toggle('active', idx === state.currentBannerIndex);
    });

    // Update Caption
    const currentBanner = state.banners[state.currentBannerIndex];
    if (currentBanner && bannerCaption) {
      bannerCaption.innerHTML = currentBanner.caption 
        ? `<span>${window.CustomModal.escape(currentBanner.caption)}</span>` 
        : `<span>Welcome to Nkem Global</span> — Quality Products & Orders`;
    }
  }

  function startBannerTimer() {
    clearInterval(state.bannerTimer);
    // Auto slide every 2 seconds
    state.bannerTimer = setInterval(() => {
      nextBanner();
    }, 2000);
  }

  function resetBannerTimer() {
    clearInterval(state.bannerTimer);
    startBannerTimer();
  }

  /* ==========================================================================
     3. TOOLBARS & CUSTOM MODULAR PICKERS (Zero Native <select>)
     ========================================================================== */
  let categoryPickerInstance = null;
  let sortPickerInstance = null;

  function initToolbars() {
    // Categories Picker
    const categoryOptions = [
      { value: 'all', label: 'All Categories' },
      ...state.categories.map(c => ({ value: c.id, label: c.name }))
    ];

    categoryPickerInstance = window.CustomPicker.create({
      container: categoryPickerMount,
      id: 'customCategoryPicker',
      title: 'Filter by Category',
      options: categoryOptions,
      value: state.selectedCategory,
      placeholder: 'All Categories',
      onChange: (val) => {
        state.selectedCategory = val;
        reloadProducts();
      }
    });

    // Sort Picker
    const sortOptions = [
      { value: 'newest', label: 'Newest to Oldest' },
      { value: 'oldest', label: 'Oldest to Newest' },
      { value: 'price_low', label: 'Price: Low to High' },
      { value: 'price_high', label: 'Price: High to Low' },
      { value: 'name_asc', label: 'Name: A to Z' }
    ];

    sortPickerInstance = window.CustomPicker.create({
      container: sortPickerMount,
      id: 'customSortPicker',
      title: 'Sort Products',
      options: sortOptions,
      value: state.selectedSort,
      placeholder: 'Sort By...',
      onChange: (val) => {
        state.selectedSort = val;
        reloadProducts();
      }
    });

    initViewToggle();
  }

  /* ---------------- Grid / List View Arrangement Toggle ---------------- */
  function applyProductView(view) {
    state.currentView = view;
    try {
      localStorage.setItem('nkem_product_view', view);
    } catch (_) {}

    if (view === 'list') {
      productGrid.classList.add('list-view');
      if (viewListBtn) viewListBtn.classList.add('active');
      if (viewGridBtn) viewGridBtn.classList.remove('active');
    } else {
      productGrid.classList.remove('list-view');
      if (viewGridBtn) viewGridBtn.classList.add('active');
      if (viewListBtn) viewListBtn.classList.remove('active');
    }
  }

  function initViewToggle() {
    if (viewGridBtn) {
      viewGridBtn.addEventListener('click', () => applyProductView('grid'));
    }
    if (viewListBtn) {
      viewListBtn.addEventListener('click', () => applyProductView('list'));
    }
    // Default or stored view state
    applyProductView(state.currentView);
  }

  async function reloadProducts() {
    state.products = [];
    state.filteredProducts = [];
    state.hasMoreProducts = false;
    updateSeeMoreButton();

    productGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px; color: var(--accent-gold); animation: spin 0.8s linear infinite; display: inline-block;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        <p style="color: var(--text-muted); font-size: var(--font-sm); margin-top: 10px;">Loading collection...</p>
      </div>
    `;

    try {
      const prods = await window.SupabaseService.getProducts({
        limit: state.pageSize,
        offset: 0,
        categoryId: state.selectedCategory,
        sort: state.selectedSort
      });

      state.products = prods || [];
      state.filteredProducts = [...state.products];
      state.hasMoreProducts = Array.isArray(prods) && prods.length === state.pageSize;
    } catch (err) {
      console.error('Failed to reload products:', err);
    }

    renderProductGrid();
    updateSeeMoreButton();
  }

  function applyFiltersAndSort() {
    let prods = [...state.products];

    // Category filter
    if (state.selectedCategory !== 'all') {
      prods = prods.filter(p => p.category_id === state.selectedCategory);
    }

    // Sort
    if (state.selectedSort === 'newest') {
      prods.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (state.selectedSort === 'oldest') {
      prods.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (state.selectedSort === 'price_low') {
      prods.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (state.selectedSort === 'price_high') {
      prods.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (state.selectedSort === 'name_asc') {
      prods.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    state.filteredProducts = prods;
    renderProductGrid();
  }

  /* ==========================================================================
     4. PRODUCT GRID & CARDS (2s Auto-Slide on Multi-Image Cards)
     ========================================================================== */
  function renderProductGrid() {
    // Clear old card timers
    Object.values(state.productCardTimers).forEach(t => clearInterval(t));
    state.productCardTimers = {};

    if (state.filteredProducts.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <p style="color: var(--text-muted); font-size: var(--font-base);">No products found matching your selection.</p>
        </div>
      `;
      updateSeeMoreButton();
      return;
    }

    productGrid.innerHTML = state.filteredProducts.map(prod => {
      const images = Array.isArray(prod.images) && prod.images.length > 0 
        ? prod.images 
        : ['assets/images/logo.jpeg'];
      
      const hasMultipleImages = images.length > 1;

      return `
        <article class="product-card" data-id="${prod.id}">
          <div class="product-card-img-wrap" data-prod-id="${prod.id}">
            ${images.map((imgSrc, i) => `
              <img class="product-card-img-slide ${i === 0 ? 'active' : ''}" 
                   src="${imgSrc}" 
                   alt="${window.CustomModal.escape(prod.title)} View ${i + 1}" 
                   data-slide-idx="${i}" />
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
              <button class="btn btn-order-now btn-card-order" type="button" data-id="${prod.id}">
                ${window.renderIcon('orderNow')}
                <span>Order Now</span>
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
          }, 2000); // Strict 2-second auto slide
        }
      }
    });

    // Attach card click handlers (Opens details modal)
    productGrid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-order')) {
          e.stopPropagation();
          const prodId = card.getAttribute('data-id');
          openOrderChoiceFlow(prodId);
          return;
        }

        const prodId = card.getAttribute('data-id');
        openProductDetailsModal(prodId);
      });
    });

    updateSeeMoreButton();
  }

  /* ---------------- Batch Pagination / See More Handler ---------------- */
  function updateSeeMoreButton() {
    if (!seeMoreContainer) return;
    if (state.hasMoreProducts && state.filteredProducts.length > 0) {
      seeMoreContainer.style.display = 'flex';
    } else {
      seeMoreContainer.style.display = 'none';
    }
  }

  function initSeeMore() {
    if (!seeMoreBtn) return;
    seeMoreBtn.addEventListener('click', async () => {
      if (state.isLoadingMore || !state.hasMoreProducts) return;
      state.isLoadingMore = true;
      seeMoreBtn.disabled = true;
      seeMoreBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; color: var(--accent-gold); animation: spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        <span>Loading More Products...</span>
      `;

      try {
        const offset = state.products.length;
        const nextBatch = await window.SupabaseService.getProducts({
          limit: state.pageSize,
          offset: offset,
          categoryId: state.selectedCategory,
          sort: state.selectedSort
        });

        if (nextBatch && nextBatch.length > 0) {
          const newItems = nextBatch.filter(nb => !state.products.some(p => p.id === nb.id));
          state.products = [...state.products, ...newItems];
          state.filteredProducts = [...state.products];
          state.hasMoreProducts = (nextBatch.length === state.pageSize);
          renderProductGrid();
        } else {
          state.hasMoreProducts = false;
        }
      } catch (err) {
        console.error('Failed to load more products:', err);
      } finally {
        state.isLoadingMore = false;
        seeMoreBtn.disabled = false;
        seeMoreBtn.innerHTML = `<span>See More Products</span>`;
        updateSeeMoreButton();
      }
    });
  }

  /* ==========================================================================
     5. FULL PRODUCT DETAILS MODAL (No Auto 2s Slide, Clickable Sub-Thumbnails)
     ========================================================================== */
  let currentModalSelectedImage = '';

  function openProductDetailsModal(prodId) {
    const prod = state.products.find(p => p.id === prodId);
    if (!prod) return;

    state.activeProductForOrder = prod;
    const images = Array.isArray(prod.images) && prod.images.length > 0 
      ? prod.images 
      : ['assets/images/logo.jpeg'];

    currentModalSelectedImage = images[0];

    const modalContent = detailsModalOverlay.querySelector('.product-details-modal-box');
    modalContent.innerHTML = `
      <div class="c-modal-header">
        <h3 class="c-modal-title">Product Details</h3>
        <button class="c-modal-close-btn" type="button" id="closeDetailsModalBtn" aria-label="Close">
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

          <!-- Slideable Sub Images Under Preview (With arrows, zero native scrollbars) -->
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
            <p class="details-desc-body">${window.CustomModal.escape(prod.description)}</p>
          </div>

          <div style="margin-top: auto; padding-top: 16px;">
            <button class="btn btn-order-now btn-primary" style="width: 100%; justify-content: center;" type="button" id="detailsOrderNowBtn">
              ${window.renderIcon('orderNow')}
              <span>Order Now — ${window.formatNaira(prod.price)}</span>
            </button>
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
    modalContent.querySelector('#detailsMainImgBox').addEventListener('click', () => {
      openFullViewLightbox(currentModalSelectedImage);
    });

    // Close Details Modal
    modalContent.querySelector('#closeDetailsModalBtn').addEventListener('click', () => {
      detailsModalOverlay.classList.remove('active');
    });

    // Order Now from Details
    modalContent.querySelector('#detailsOrderNowBtn').addEventListener('click', () => {
      detailsModalOverlay.classList.remove('active');
      openOrderChoiceFlow(prod.id);
    });

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
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
      });
    }

    fullViewLightbox.addEventListener('click', (e) => {
      if (e.target === fullViewLightbox || e.target.classList.contains('full-view-img-container')) {
        closeLightbox();
      }
    });

    fullViewLightbox.classList.add('active');
  }

  /* ==========================================================================
     7. ORDER NOW MODAL FLOW (WhatsApp vs Online Order with Custom State & LGA Pickers)
     ========================================================================== */
  function openOrderChoiceFlow(prodId) {
    const prod = state.products.find(p => p.id === prodId) || state.products[0];
    if (!prod) return;
    state.activeProductForOrder = prod;

    orderChoiceModal.innerHTML = `
      <div class="c-modal-box">
        <div class="c-modal-header">
          <h3 class="c-modal-title">Select Order Method</h3>
          <button class="c-modal-close-btn" type="button" id="closeChoiceModalBtn">
            ${window.renderIcon('close')}
          </button>
        </div>
        <div class="c-modal-body">
          <p style="color: var(--text-muted); font-size: var(--font-sm); margin-bottom: 8px;">
            Ordering: <strong style="color: var(--text-main);">${window.CustomModal.escape(prod.title)}</strong> (${window.formatNaira(prod.price)})
          </p>
          <div class="order-choice-box">
            <div class="order-choice-card whatsapp" id="chooseWhatsAppBtn">
              <div class="order-choice-icon">${window.renderIcon('whatsapp')}</div>
              <h4 class="order-choice-title">Order via WhatsApp</h4>
              <p class="order-choice-sub">Direct instant chat with our sales team</p>
            </div>
            <div class="order-choice-card online" id="chooseOnlineBtn">
              <div class="order-choice-icon">${window.renderIcon('orderNow')}</div>
              <h4 class="order-choice-title">Order Online</h4>
              <p class="order-choice-sub">Fill details & receive official order receipt</p>
            </div>
          </div>
        </div>
      </div>
    `;

    orderChoiceModal.querySelector('#closeChoiceModalBtn').addEventListener('click', () => {
      orderChoiceModal.classList.remove('active');
    });

    // 1. WhatsApp Order Flow
    orderChoiceModal.querySelector('#chooseWhatsAppBtn').addEventListener('click', () => {
      orderChoiceModal.classList.remove('active');
      const msg = `Hello Nkem Global, I would like to order: ${prod.title} (${window.formatNaira(prod.price)}). Please assist me with my order.`;
      const waUrl = `https://wa.me/2347042087633?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
    });

    // 2. Online Order Flow
    orderChoiceModal.querySelector('#chooseOnlineBtn').addEventListener('click', () => {
      orderChoiceModal.classList.remove('active');
      const currentUser = window.SupabaseService.getCurrentUser();
      if (!currentUser) {
        window.CustomModal.toast({ 
          message: 'Please sign in or create an account to place your order.', 
          type: 'info' 
        });
        window.AuthModal.showSignIn((authedUser) => {
          openOnlineOrderForm(prod, authedUser);
        });
        return;
      }
      openOnlineOrderForm(prod, currentUser);
    });

    orderChoiceModal.classList.add('active');
  }

  /* Online Order Form Modal (Prefilled with Authenticated User Information) */
  let statePickerInstance = null;
  let lgaPickerInstance = null;

  function openOnlineOrderForm(prod, user) {
    const activeUser = user || window.SupabaseService.getCurrentUser() || {};

    onlineOrderModal.innerHTML = `
      <div class="c-modal-box" style="max-width: 560px;">
        <div class="c-modal-header">
          <div class="c-modal-title-wrap">
            <h3 class="c-modal-title">Confirm Delivery & Order</h3>
          </div>
          <button class="c-modal-close-btn" type="button" id="closeOnlineOrderBtn">
            ${window.renderIcon('close')}
          </button>
        </div>

        <form id="onlineOrderForm" class="c-modal-body" style="display: flex; flex-direction: column; gap: 14px;">
          <div style="background: var(--bg-main); padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: var(--font-xs); color: var(--text-muted);">
            Item: <strong style="color: var(--accent-gold);">${window.CustomModal.escape(prod.title)}</strong> &bull; Total: <strong style="color: var(--text-main);">${window.formatNaira(prod.price)}</strong>
          </div>

          <div class="order-form-grid">
            <div class="form-group">
              <label class="form-label">First Name <span class="req">*</span></label>
              <input type="text" class="input-field" id="orderFirstName" required value="${window.CustomModal.escape(activeUser.first_name || '')}" placeholder="First Name" />
            </div>
            <div class="form-group">
              <label class="form-label">Last Name <span class="req">*</span></label>
              <input type="text" class="input-field" id="orderLastName" required value="${window.CustomModal.escape(activeUser.last_name || '')}" placeholder="Last Name" />
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp Number <span class="req">*</span></label>
              <input type="tel" class="input-field" id="orderWhatsApp" required value="${window.CustomModal.escape(activeUser.whatsapp_number || '')}" placeholder="WhatsApp Phone" />
            </div>
            <div class="form-group">
              <label class="form-label">Email (Optional)</label>
              <input type="email" class="input-field" id="orderEmail" value="${window.CustomModal.escape(activeUser.email || '')}" placeholder="customer@gmail.com" />
            </div>

            <!-- Custom Modal / Bottom Sheet Pickers for State & LGA (Zero native <select>) -->
            <div class="form-group">
              <label class="form-label">State <span class="req">*</span></label>
              <div id="mountOrderStatePicker" class="c-picker-container"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Local Government Area (LGA) <span class="req">*</span></label>
              <div id="mountOrderLgaPicker" class="c-picker-container"></div>
            </div>

            <div class="form-group col-span-2">
              <label class="form-label">Street / Delivery Address <span class="req">*</span></label>
              <textarea class="textarea-field" id="orderAddress" required placeholder="Enter house number, street name, landmarks...">${window.CustomModal.escape(activeUser.address || '')}</textarea>
            </div>
          </div>

          <div class="c-modal-footer dual-actions" style="margin: 0 -16px -16px -16px; padding: 12px 16px;">
            <button class="btn btn-secondary" type="button" id="cancelOnlineOrderBtn">Cancel</button>
            <button class="btn btn-primary" type="submit" id="submitOnlineOrderBtn">
              ${window.renderIcon('send')}
              <span>Place Order (${window.formatNaira(prod.price)})</span>
            </button>
          </div>
        </form>
      </div>
    `;

    // Initialize State & LGA Custom Pickers (Strictly Zero Default State or LGA)
    const statesData = window.NIGERIA_STATES_DATA || {};
    const stateNames = Object.keys(statesData).sort();

    let selectedState = activeUser.state && statesData[activeUser.state] ? activeUser.state : '';
    let currentLgas = selectedState ? (statesData[selectedState] || []) : [];
    let selectedLga = activeUser.lga && currentLgas.includes(activeUser.lga) ? activeUser.lga : '';

    const stateMount = onlineOrderModal.querySelector('#mountOrderStatePicker');
    const lgaMount = onlineOrderModal.querySelector('#mountOrderLgaPicker');

    statePickerInstance = window.CustomPicker.create({
      container: stateMount,
      title: 'Select Destination State',
      options: stateNames.map(s => ({ value: s, label: s })),
      value: selectedState,
      placeholder: 'Choose State...',
      onChange: (newState) => {
        selectedState = newState;
        const newLgas = statesData[selectedState] || [];
        selectedLga = '';
        if (lgaPickerInstance) {
          lgaPickerInstance.setOptions(newLgas.map(l => ({ value: l, label: l })));
          lgaPickerInstance.setValue('');
          if (lgaPickerInstance.setDisabled) {
            lgaPickerInstance.setDisabled(!newState);
          }
        }
      }
    });

    lgaPickerInstance = window.CustomPicker.create({
      container: lgaMount,
      title: 'Select Local Government Area (LGA)',
      options: currentLgas.map(l => ({ value: l, label: l })),
      value: selectedLga,
      placeholder: selectedState ? 'Choose LGA...' : 'Choose State First...',
      onChange: (newLga) => {
        selectedLga = newLga;
      }
    });

    if (lgaPickerInstance && !selectedState && lgaPickerInstance.setDisabled) {
      lgaPickerInstance.setDisabled(true);
    }

    let isSubmittingOrder = false;
    const closeForm = () => {
      if (isSubmittingOrder) return;
      onlineOrderModal.classList.remove('active');
    };
    onlineOrderModal.querySelector('#closeOnlineOrderBtn').addEventListener('click', closeForm);
    onlineOrderModal.querySelector('#cancelOnlineOrderBtn').addEventListener('click', closeForm);

    const orderFnInput = document.getElementById('orderFirstName');
    const orderLnInput = document.getElementById('orderLastName');
    if (window.attachNameAutoCapitalize) {
      window.attachNameAutoCapitalize(orderFnInput);
      window.attachNameAutoCapitalize(orderLnInput);
    }

    const form = onlineOrderModal.querySelector('#onlineOrderForm');
    const submitBtn = form.querySelector('#submitOnlineOrderBtn');
    const cancelBtn = form.querySelector('#cancelOnlineOrderBtn');
    const closeBtn = onlineOrderModal.querySelector('#closeOnlineOrderBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isSubmittingOrder) return;

      const firstName = window.capitalizeName ? window.capitalizeName(orderFnInput.value) : orderFnInput.value.trim();
      const lastName = window.capitalizeName ? window.capitalizeName(orderLnInput.value) : orderLnInput.value.trim();
      const whatsapp = document.getElementById('orderWhatsApp').value.trim();
      const email = document.getElementById('orderEmail').value.trim();
      const address = document.getElementById('orderAddress').value.trim();

      if (!firstName || !lastName || !whatsapp || !address) {
        window.CustomModal.toast({ message: 'Please fill in all required fields.', type: 'danger' });
        return;
      }

      if (!selectedState) {
        window.CustomModal.toast({ message: 'Please select a delivery State.', type: 'warning' });
        return;
      }

      if (!selectedLga) {
        window.CustomModal.toast({ message: 'Please select a Local Government Area (LGA).', type: 'warning' });
        return;
      }

      // Lock form and display high-end processing indicator
      isSubmittingOrder = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.85';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.innerHTML = `
          <span style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.3); border-top-color: #0b0c0e; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px;"></span>
          <span>Processing Order...</span>
        `;
      }
      if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.style.opacity = '0.5';
        cancelBtn.style.cursor = 'not-allowed';
      }
      if (closeBtn) {
        closeBtn.disabled = true;
      }

      const coverImg = Array.isArray(prod.images) && prod.images[0] ? prod.images[0] : 'assets/images/logo.jpeg';

      const orderId = `ord-${Date.now()}`;
      const orderData = {
        id: orderId,
        retrieval_code: `NKG-${Date.now()}`,
        user_id: activeUser.id || null,
        product_id: prod.id,
        product_title: prod.title,
        product_price: prod.price,
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

        // Send rich Order Card directly into customer <-> admin chat
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
              product_id: prod.id,
              product_title: prod.title,
              product_price: prod.price,
              product_image: coverImg,
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
            message: `Order Request: ${prod.title} (${window.formatNaira(prod.price)}) - Status: Pending`,
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

        isSubmittingOrder = false;
        onlineOrderModal.classList.remove('active');
        openOrderSuccessModal(orderData);
      } catch (err) {
        console.error('Order placement notice:', err);
        isSubmittingOrder = false;
        onlineOrderModal.classList.remove('active');
        openOrderSuccessModal(orderData);
      }
    });

    onlineOrderModal.classList.add('active');
  }

  /* ==========================================================================
     8. ORDER CONFIRMATION MODAL & RECEIPT IMAGE DOWNLOAD (Zero Retrieval Code)
     ========================================================================== */
  function openOrderSuccessModal(order) {
    orderSuccessModal.innerHTML = `
      <div class="c-modal-box" style="max-width: 500px;">
        <div class="c-modal-header">
          <div class="c-modal-title-wrap">
            <h3 class="c-modal-title">Order Request Received!</h3>
          </div>
          <button class="c-modal-close-btn" type="button" id="closeSuccessModalBtn">
            ${window.renderIcon('close')}
          </button>
        </div>

        <div class="c-modal-body receipt-modal-box">
          <p class="c-modal-text">
            Thank you, <strong>${window.CustomModal.escape(order.first_name)} ${window.CustomModal.escape(order.last_name)}</strong>! Your order request for <strong>${window.CustomModal.escape(order.product_title)}</strong> has been recorded.
          </p>

          <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; margin: 10px 0; font-size: var(--font-xs); line-height: 1.6; text-align: left;">
            <div><strong>Item:</strong> ${window.CustomModal.escape(order.product_title)}</div>
            <div><strong>Total:</strong> <span style="color: var(--accent-gold); font-weight: 700;">${window.formatNaira(order.product_price)}</span></div>
            <div><strong>Destination:</strong> ${window.CustomModal.escape(order.lga)}, ${window.CustomModal.escape(order.state)} State</div>
            <div><strong>WhatsApp:</strong> ${window.CustomModal.escape(order.whatsapp_number)}</div>
          </div>

          <div class="code-actions-row">
            <button class="btn btn-primary" type="button" id="downloadReceiptImgBtn" style="flex: 1; justify-content: center;">
              ${window.renderIcon('download')}
              <span>Download Official Receipt</span>
            </button>
          </div>

          <p style="font-size: var(--font-xs); color: var(--text-muted); margin-top: 8px;">
            The downloaded receipt carries Nkem Global brand logo, shop contact info, and complete order specifications.
          </p>

          <div style="padding-top: 12px; border-top: 1px solid var(--border-color); margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center;" type="button" id="trackInOrdersBtn">
              <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span>Track in My Orders</span>
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

    orderSuccessModal.querySelector('#downloadReceiptImgBtn').addEventListener('click', async () => {
      window.CustomModal.toast({ message: 'Generating receipt with Nkem Global contact info...', type: 'info' });
      await window.ReceiptGenerator.downloadReceiptImage(order);
      window.CustomModal.toast({ message: 'Receipt image downloaded!', type: 'success' });
    });

    const closeSuccess = () => orderSuccessModal.classList.remove('active');
    orderSuccessModal.querySelector('#closeSuccessModalBtn').addEventListener('click', closeSuccess);
    orderSuccessModal.querySelector('#closeSuccessBtn').addEventListener('click', closeSuccess);

    const trackBtn = orderSuccessModal.querySelector('#trackInOrdersBtn');
    if (trackBtn) {
      trackBtn.addEventListener('click', () => {
        closeSuccess();
        openMyOrdersModal();
      });
    }

    orderSuccessModal.classList.add('active');
  }

  /* ==========================================================================
     9. MY ORDERS MODAL (Track Status, Live Cancel Before Approval)
     ========================================================================== */
  async function openMyOrdersModal() {
    const user = window.SupabaseService.getCurrentUser();
    if (!user) {
      window.AuthModal.showSignIn();
      return;
    }

    // Remove any existing modal overlay to prevent duplicates
    const oldModal = document.getElementById('myOrdersModalOverlay');
    if (oldModal && oldModal.parentNode) oldModal.parentNode.removeChild(oldModal);

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'c-modal-overlay active';
    modalOverlay.id = 'myOrdersModalOverlay';

    modalOverlay.innerHTML = `
      <div class="c-modal-box" style="max-width: 680px; max-height: 88vh; display: flex; flex-direction: column;">
        <div class="c-modal-header">
          <div>
            <h3 class="c-modal-title">My Orders</h3>
            <span style="font-size: var(--font-xs); color: var(--text-muted);">Track your order requests and live delivery status</span>
          </div>
          <button class="c-modal-close-btn" type="button" id="closeMyOrdersBtn" aria-label="Close">
            ${window.renderIcon('close')}
          </button>
        </div>

        <!-- Obsidian Filter Pills matching Admin Panel -->
        <div class="user-orders-filter-row" style="padding: 10px 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-surface-elevated); display: flex; align-items: center; justify-content: flex-start; gap: 8px;">
          <div class="user-orders-pills-wrap" id="userOrderFilterPills" style="display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -webkit-overflow-scrolling: touch; width: 100%;">
            <button type="button" class="admin-filter-pill active" data-status="all">
              <span>All</span>
              <span class="pill-badge" id="userCountAll">0</span>
            </button>
            <button type="button" class="admin-filter-pill" data-status="pending">
              <span>Pending</span>
              <span class="pill-badge" id="userCountPending">0</span>
            </button>
            <button type="button" class="admin-filter-pill" data-status="approved">
              <span>Approved</span>
              <span class="pill-badge" id="userCountApproved">0</span>
            </button>
            <button type="button" class="admin-filter-pill" data-status="shipping">
              <span>Shipping</span>
              <span class="pill-badge" id="userCountShipping">0</span>
            </button>
            <button type="button" class="admin-filter-pill" data-status="delivered">
              <span>Delivered</span>
              <span class="pill-badge" id="userCountDelivered">0</span>
            </button>
            <button type="button" class="admin-filter-pill" data-status="declined">
              <span>Declined</span>
              <span class="pill-badge" id="userCountDeclined">0</span>
            </button>
          </div>
        </div>

        <div class="c-modal-body" id="myOrdersListContainer" style="overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1;">
          <!-- Orders rendered immediately in 0ms without delay -->
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    let activeFilterStatus = 'all';
    let currentOrdersList = [];

    const statusUpdateHandler = () => {
      if (modalOverlay.parentNode) {
        renderFilteredOrders();
      }
    };
    window.addEventListener('nkem_order_status_updated', statusUpdateHandler);

    const closeModal = () => {
      window.removeEventListener('nkem_order_status_updated', statusUpdateHandler);
      if (modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
    };

    modalOverlay.querySelector('#closeMyOrdersBtn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    // Wire up filter pill clicks
    const pillsWrap = modalOverlay.querySelector('#userOrderFilterPills');
    if (pillsWrap) {
      pillsWrap.addEventListener('click', (e) => {
        const pill = e.target.closest('.admin-filter-pill');
        if (!pill) return;
        activeFilterStatus = pill.getAttribute('data-status') || 'all';
        pillsWrap.querySelectorAll('.admin-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        renderFilteredOrders();
      });
    }

    const container = modalOverlay.querySelector('#myOrdersListContainer');

    function cleanDeliveryAddress(rawDelivery, lga, state) {
      let text = String(rawDelivery || '').trim();
      if (!text) {
        text = [lga, state ? `${state} State` : ''].filter(Boolean).join(', ');
      }
      if (!text) return 'Address on file';

      const parts = text.split(',').map(s => s.trim()).filter(Boolean);
      const seen = new Set();
      const cleaned = [];

      for (const part of parts) {
        const norm = part.toLowerCase().replace(/\s+state$/i, '').trim();
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          cleaned.push(part);
        }
      }

      if (state) {
        const normState = state.toLowerCase().replace(/\s+state$/i, '').trim();
        if (!seen.has(normState)) {
          seen.add(normState);
          cleaned.push(`${state.replace(/\s+state$/i, '').trim()} State`);
        }
      }

      return cleaned.join(', ') || 'Address on file';
    }

    function renderFilteredOrders() {
      try {
        // Calculate counts
        const counts = {
          all: currentOrdersList.length,
          pending: 0,
          approved: 0,
          shipping: 0,
          delivered: 0,
          declined: 0
        };

        currentOrdersList.forEach(o => {
          let st = 'pending';
          if (window.SupabaseService && window.SupabaseService.getOrderStatus) {
            st = window.SupabaseService.getOrderStatus(o.id || o.order_id);
          } else {
            st = String(o.status || 'pending').toLowerCase();
          }
          if (st === 'pending') counts.pending++;
          else if (st === 'approved') counts.approved++;
          else if (st === 'shipping' || st === 'shipped') counts.shipping++;
          else if (st === 'delivered') counts.delivered++;
          else if (st === 'declined') counts.declined++;
        });

        // Update pill count labels
        const cAll = modalOverlay.querySelector('#userCountAll');
        const cPen = modalOverlay.querySelector('#userCountPending');
        const cApp = modalOverlay.querySelector('#userCountApproved');
        const cShip = modalOverlay.querySelector('#userCountShipping');
        const cDeliv = modalOverlay.querySelector('#userCountDelivered');
        const cDec = modalOverlay.querySelector('#userCountDeclined');
        if (cAll) cAll.textContent = counts.all;
        if (cPen) cPen.textContent = counts.pending;
        if (cApp) cApp.textContent = counts.approved;
        if (cShip) cShip.textContent = counts.shipping;
        if (cDeliv) cDeliv.textContent = counts.delivered;
        if (cDec) cDec.textContent = counts.declined;

        // Filter orders
        const filtered = currentOrdersList.filter(o => {
          if (activeFilterStatus === 'all') return true;
          let st = 'pending';
          if (window.SupabaseService && window.SupabaseService.getOrderStatus) {
            st = window.SupabaseService.getOrderStatus(o.id || o.order_id);
          } else {
            st = String(o.status || 'pending').toLowerCase();
          }
          if (activeFilterStatus === 'shipping') return st === 'shipping' || st === 'shipped';
          return st === activeFilterStatus;
        });

        if (currentOrdersList.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; padding: 48px; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
              <p style="color: var(--text-muted); font-size: var(--font-sm); margin: 0 0 14px 0;">You have not placed any orders yet.</p>
              <button class="btn btn-primary btn-sm" type="button" id="browseProdsBtn">
                <span>Browse Products</span>
              </button>
            </div>
          `;
          container.querySelector('#browseProdsBtn')?.addEventListener('click', () => {
            closeModal();
            document.getElementById('catalogSection')?.scrollIntoView({ behavior: 'smooth' });
          });
          return;
        }

        if (filtered.length === 0) {
          container.innerHTML = `
            <div style="text-align: center; padding: 48px; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
              <p style="color: var(--text-muted); font-size: var(--font-sm); margin: 0 0 14px 0;">No orders found in this category.</p>
              <button class="btn btn-secondary btn-sm" type="button" id="resetUserFilterBtn">
                <span>View All Orders</span>
              </button>
            </div>
          `;
          container.querySelector('#resetUserFilterBtn')?.addEventListener('click', () => {
            activeFilterStatus = 'all';
            pillsWrap.querySelectorAll('.admin-filter-pill').forEach(p => {
              if (p.getAttribute('data-status') === 'all') p.classList.add('active');
              else p.classList.remove('active');
            });
            renderFilteredOrders();
          });
          return;
        }

        container.innerHTML = filtered.map(ord => {
          const prod = (state && state.products ? state.products : []).find(p => p.id === ord.product_id);
          const coverImg = (prod && Array.isArray(prod.images) && prod.images[0]) || ord.product_image || 'assets/images/logo.jpeg';
          
          let dateStr = 'Recently';
          try {
            if (ord.created_at) {
              dateStr = new Date(ord.created_at).toLocaleString();
            }
          } catch (e) {
            dateStr = 'Recently';
          }

          let status = 'pending';
          if (window.SupabaseService && window.SupabaseService.getOrderStatus) {
            status = window.SupabaseService.getOrderStatus(ord.id || ord.order_id);
          } else {
            status = String(ord.status || 'pending').toLowerCase();
          }
          const isPending = status === 'pending';

          let statusBadge = '';
          if (status === 'pending') {
            statusBadge = `<span class="order-status-badge status-pending">Pending Admin Approval</span>`;
          } else if (status === 'approved') {
            statusBadge = `<span class="order-status-badge status-approved">Approved &bull; Order Confirmed</span>`;
          } else if (status === 'shipping' || status === 'shipped') {
            statusBadge = `<span class="order-status-badge status-shipping">In Transit &bull; Shipping</span>`;
          } else if (status === 'delivered') {
            statusBadge = `<span class="order-status-badge status-delivered">Delivered Successfully</span>`;
          } else if (status === 'declined') {
            statusBadge = `<span class="order-status-badge status-declined">Order Declined</span>`;
          } else if (status === 'cancelled') {
            statusBadge = `<span class="order-status-badge status-cancelled">Order Cancelled</span>`;
          } else {
            statusBadge = `<span class="order-status-badge status-pending">${window.CustomModal ? window.CustomModal.escape(status) : status}</span>`;
          }

          const safePrice = window.formatNaira ? window.formatNaira(ord.product_price || 0) : '₦' + (ord.product_price || 0);
          const safeTitle = window.CustomModal ? window.CustomModal.escape(ord.product_title || 'Nkem Global Product') : (ord.product_title || 'Nkem Global Product');
          const safeId = String(ord.id || ord.order_id || '').toUpperCase();
          const cleanAddr = cleanDeliveryAddress(ord.delivery_address || ord.address || '', ord.lga, ord.state);
          const safeDelivery = window.CustomModal ? window.CustomModal.escape(cleanAddr) : cleanAddr;

          return `
            <div class="user-order-card" data-order-id="${ord.id}" style="cursor: pointer;">
              <div class="user-order-card-header">
                <span class="user-order-ref">Order #${safeId}</span>
                <span class="user-order-date">${dateStr}</span>
              </div>

              <div class="user-order-body">
                <img src="${coverImg}" class="user-order-thumb" alt="${safeTitle}" style="cursor: pointer;" title="Click to view image" />
                <div class="user-order-info">
                  <h4 class="user-order-title">${safeTitle}</h4>
                  <div class="user-order-price">${safePrice}</div>
                  <div class="user-order-addr" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    Delivery: ${safeDelivery}
                  </div>
                </div>
              </div>

              <div class="user-order-footer">
                <div class="user-order-status-wrap">
                  ${statusBadge}
                </div>

                <div class="user-order-actions" style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button class="btn btn-secondary btn-sm btn-view-receipt" type="button" data-id="${ord.id}" title="View order details and download official receipt">
                    ${window.renderIcon('download')}
                    <span>Receipt</span>
                  </button>
                  ${isPending ? `
                    <button class="btn btn-secondary btn-sm btn-cancel-order" type="button" data-id="${ord.id}" style="color: var(--status-danger); border-color: rgba(220, 53, 69, 0.4);">
                      <span>Cancel Order</span>
                    </button>
                  ` : ''}
                  <a href="chat.html" class="btn btn-secondary btn-sm" style="gap: 4px;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>Chat with Admin</span>
                  </a>
                </div>
              </div>
            </div>
          `;
        }).join('');

        // Order card click -> Open full order details modal
        container.querySelectorAll('.user-order-card').forEach(card => {
          card.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.user-order-thumb')) return;
            const ordId = card.getAttribute('data-order-id');
            const found = currentOrdersList.find(o => o.id === ordId);
            if (found && window.openChatOrderDetailsModal) {
              window.openChatOrderDetailsModal(found, false);
            }
          });
        });

        // Thumbnail image click -> Full View Lightbox
        container.querySelectorAll('.user-order-thumb').forEach(thumb => {
          thumb.addEventListener('click', (e) => {
            e.stopPropagation();
            const src = thumb.getAttribute('src');
            if (window.openFullViewLightbox) {
              window.openFullViewLightbox(src);
            }
          });
        });

        // Receipt modal / download listener
        container.querySelectorAll('.btn-view-receipt').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ordId = btn.getAttribute('data-id');
            const found = currentOrdersList.find(o => o.id === ordId);
            if (found && window.openChatOrderDetailsModal) {
              window.openChatOrderDetailsModal(found, false);
            } else if (found && window.ReceiptGenerator) {
              window.ReceiptGenerator.downloadReceiptImage(found);
            }
          });
        });

        // Cancel button listeners
        container.querySelectorAll('.btn-cancel-order').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const orderId = btn.getAttribute('data-id');
            const confirmed = await window.CustomModal.confirm({
              title: 'Cancel Order',
              message: 'Are you sure you want to cancel this order request? This action cannot be undone.',
              confirmText: 'Yes, Cancel Order',
              isDanger: true
            });

            if (confirmed) {
              btn.disabled = true;
              btn.innerHTML = `<span>Cancelling...</span>`;
              try {
                await window.SupabaseService.cancelUserOrder(orderId, user.id);

                // Post status update to live chat
                await window.SupabaseService.sendUserChatMessage({
                  id: `msg-cancel-${orderId}-${Date.now()}`,
                  order_code: orderId,
                  user_id: user.id,
                  user_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Customer',
                  user_whatsapp: user.whatsapp_number,
                  sender: 'user',
                  message: `Order Cancelled: Order #${orderId} was cancelled by the customer.`,
                  image_url: null,
                  is_read_by_admin: false,
                  is_read_by_user: true,
                  deleted_for_everyone: false,
                  deleted_for_user: false,
                  deleted_for_admin: false,
                  created_at: new Date().toISOString()
                });

                window.CustomModal.toast({ message: 'Order has been cancelled.', type: 'info' });
                closeModal();
                openMyOrdersModal();
              } catch (err) {
                window.CustomModal.toast({ message: err.message || 'Failed to cancel order.', type: 'danger' });
                btn.disabled = false;
                btn.innerHTML = `<span>Cancel Order</span>`;
              }
            }
          });
        });
      } catch (renderErr) {
        console.error('renderFilteredOrders error:', renderErr);
        container.innerHTML = `
          <div style="text-align: center; padding: 36px; color: var(--text-muted); font-size: var(--font-sm);">
            <p>Could not display orders.</p>
            <button class="btn btn-secondary btn-sm" onclick="this.closest('.c-modal-overlay').remove()">Close</button>
          </div>
        `;
      }
    }

    function setOrdersData(ordersRaw) {
      const seenOrderIds = new Set();
      const deduped = [];
      (ordersRaw || []).forEach(o => {
        if (!o) return;
        const cid = String(o.id || o.order_id || o.order_code || o.retrieval_code || '').trim().toLowerCase();
        if (cid && !seenOrderIds.has(cid)) {
          seenOrderIds.add(cid);
          deduped.push(o);
        }
      });
      currentOrdersList = deduped;
      renderFilteredOrders();
    }

    // Step 1: Render cached local orders immediately (0ms instant display - ZERO waiting)
    const userPhone = user.whatsapp_number || user.phone || user.whatsapp || '';
    let localOrders = [];
    try {
      if (window.SupabaseService && window.SupabaseService.getUserOrdersSync) {
        localOrders = window.SupabaseService.getUserOrdersSync(user.id, userPhone, user.email);
      }
    } catch (syncErr) {
      console.warn('getUserOrdersSync error:', syncErr);
    }

    setOrdersData(localOrders);

    // Step 2: Fetch fresh orders from Supabase with background sync
    try {
      window.SupabaseService.getUserOrders(user.id, userPhone, user.email, 2500).then(fresh => {
        if (modalOverlay.parentNode && Array.isArray(fresh) && fresh.length > 0) {
          setOrdersData(fresh);
        }
      }).catch(e => console.warn('Background fresh orders sync notice (using local):', e));
    } catch (err) {
      console.warn('Background fresh orders sync notice (using local):', err);
    }
  }

  /* ==========================================================================
     10. USER AUTH STATUS & UNREAD MESSAGE NOTIFICATION BADGE
     ========================================================================== */
  function renderUserAuthHeader() {
    const user = window.SupabaseService.getCurrentUser();
    const navMyOrders = document.getElementById('navMyOrdersLink');
    const mobMyOrders = document.getElementById('mobMyOrdersLink');

    if (user) {
      if (navMyOrders) {
        navMyOrders.style.display = 'inline-flex';
        navMyOrders.onclick = (e) => {
          e.preventDefault();
          openMyOrdersModal();
        };
      }
      if (mobMyOrders) {
        mobMyOrders.style.display = 'block';
        mobMyOrders.onclick = (e) => {
          e.preventDefault();
          const mobModal = document.getElementById('mobileMenuModal');
          if (mobModal) mobModal.classList.remove('active');
          openMyOrdersModal();
        };
      }
    } else {
      if (navMyOrders) navMyOrders.style.display = 'none';
      if (mobMyOrders) mobMyOrders.style.display = 'none';
    }

    // Desktop Header
    if (headerAuthContainer) {
      if (!user) {
        headerAuthContainer.innerHTML = `
          <button class="btn btn-secondary btn-sm" type="button" id="deskSignInBtn">
            <span>Sign In</span>
          </button>
        `;
        headerAuthContainer.querySelector('#deskSignInBtn').addEventListener('click', () => {
          window.AuthModal.showSignIn();
        });
      } else {
        headerAuthContainer.innerHTML = `
          <div class="user-pill" style="cursor: pointer;" id="deskUserPill" title="View Profile & Settings">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span class="user-pill-name">${window.CustomModal.escape(user.first_name)}</span>
            <button class="btn-pill-logout" type="button" id="deskLogoutBtn" title="Logout">Logout</button>
          </div>
        `;
        headerAuthContainer.querySelector('.user-pill-name').addEventListener('click', (e) => {
          e.stopPropagation();
          window.AuthModal.showProfile();
        });
        headerAuthContainer.querySelector('#deskLogoutBtn').addEventListener('click', (e) => {
          e.stopPropagation();
          window.CustomModal.confirm({
            title: 'Sign Out',
            message: 'Are you sure you want to sign out?',
            confirmText: 'Sign Out',
            onConfirm: () => {
              window.SupabaseService.logoutUser();
              window.CustomModal.toast({ message: 'Signed out successfully.', type: 'info' });
            }
          });
        });
      }
    }

    // Mobile Drawer
    if (mobileAuthContainer) {
      if (!user) {
        mobileAuthContainer.innerHTML = `
          <button class="btn btn-secondary btn-sm" type="button" id="mobSignInBtn" style="width: 100%; justify-content: center;">
            <span>Sign In / Create Account</span>
          </button>
        `;
        mobileAuthContainer.querySelector('#mobSignInBtn').addEventListener('click', () => {
          const mobModal = document.getElementById('mobileMenuModal');
          if (mobModal) mobModal.classList.remove('active');
          window.AuthModal.showSignIn();
        });
      } else {
        mobileAuthContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: var(--font-xs);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <strong style="color: var(--accent-gold);">${window.CustomModal.escape(user.first_name)} ${window.CustomModal.escape(user.last_name)}</strong>
              </div>
              <button class="btn-pill-logout" type="button" id="mobLogoutBtn" style="color: var(--status-danger);">Logout</button>
            </div>
            <button class="btn btn-secondary btn-sm" type="button" id="mobProfileBtn" style="width: 100%; justify-content: center;">
              <span>Profile & Account Settings</span>
            </button>
          </div>
        `;
        mobileAuthContainer.querySelector('#mobProfileBtn').addEventListener('click', () => {
          const mobModal = document.getElementById('mobileMenuModal');
          if (mobModal) mobModal.classList.remove('active');
          window.AuthModal.showProfile();
        });
        mobileAuthContainer.querySelector('#mobLogoutBtn').addEventListener('click', () => {
          const mobModal = document.getElementById('mobileMenuModal');
          if (mobModal) mobModal.classList.remove('active');
          window.CustomModal.confirm({
            title: 'Sign Out',
            message: 'Are you sure you want to sign out?',
            confirmText: 'Sign Out',
            onConfirm: () => {
              window.SupabaseService.logoutUser();
              window.CustomModal.toast({ message: 'Signed out successfully.', type: 'info' });
            }
          });
        });
      }
    }
  }

  async function checkUnreadMessages() {
    const user = window.SupabaseService.getCurrentUser();
    if (!user) {
      if (navChatBadge) navChatBadge.style.display = 'none';
      if (mobChatBadge) mobChatBadge.style.display = 'none';
      return;
    }

    try {
      const count = await window.SupabaseService.getUnreadCountForUser(user.id);
      if (count > 0) {
        if (navChatBadge) {
          navChatBadge.textContent = count;
          navChatBadge.style.display = 'inline-flex';
        }
        if (mobChatBadge) {
          mobChatBadge.textContent = count;
          mobChatBadge.style.display = 'inline-flex';
        }
      } else {
        if (navChatBadge) navChatBadge.style.display = 'none';
        if (mobChatBadge) mobChatBadge.style.display = 'none';
      }
    } catch (_) {}
  }

  // Expose lightbox helper globally for full view image clicks
  window.openFullViewLightbox = openFullViewLightbox;

  // Smart Top Bar Hide on Scroll Down, Reveal Instantly on the Slightest Scroll Up
  function initSmartHeaderScroll() {
    const headerBar = document.querySelector('.header-bar');
    if (!headerBar) return;

    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    let touchStartY = 0;

    function showHeader() {
      headerBar.classList.remove('header-hidden');
    }

    function hideHeader() {
      headerBar.classList.add('header-hidden');
    }

    function evaluateScroll() {
      const currentScrollY = Math.max(0, window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0);

      // Always show near top
      if (currentScrollY <= 30) {
        showHeader();
        lastScrollY = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollY;

      // Scrolling UP (even 1 pixel): instantly show
      if (diff < -1) {
        showHeader();
      }
      // Scrolling DOWN past header threshold: hide
      else if (diff > 3 && currentScrollY > 50) {
        hideHeader();
      }

      lastScrollY = currentScrollY;
    }

    // Scroll listener (covers keyboard, scrollbar drag, programmatic, mouse, momentum)
    window.addEventListener('scroll', evaluateScroll, { passive: true });

    // Wheel listener (covers trackpad & mouse wheel before scroll settles)
    window.addEventListener('wheel', (e) => {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (e.deltaY < -1) {
        showHeader();
      } else if (e.deltaY > 1 && currentScrollY > 50) {
        hideHeader();
      }
    }, { passive: true });

    // Touch listeners (covers mobile gestures with zero latency)
    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!e.touches || !e.touches[0]) return;
      const currentTouchY = e.touches[0].clientY;
      const touchDelta = currentTouchY - touchStartY;
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

      // Swiping DOWN on screen = scrolling UP page: reveal immediately
      if (touchDelta > 5) {
        showHeader();
        touchStartY = currentTouchY;
      }
      // Swiping UP on screen = scrolling DOWN page: hide
      else if (touchDelta < -8 && currentScrollY > 50) {
        hideHeader();
        touchStartY = currentTouchY;
      }
    }, { passive: true });
  }

  initSmartHeaderScroll();

  // Initial Boot
  await loadInitialData();
});
