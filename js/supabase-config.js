// Supabase Config & Cloud Sync Layer with Local Storage Fallback Cache
window.SupabaseService = {
  URL: 'https://ykwhhgajybhbmkqkmzhm.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlrd2hoZ2FqeWJoYm1rcWttemhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MTI5NzksImV4cCI6MjEwNzk4ODk3OX0.d-qkmKCGE1bbMBNZb7ROnMXC1t1RcPweeXD4Hg0atBM',

  getHeaders() {
    return {
      'apikey': this.ANON_KEY,
      'Authorization': `Bearer ${this.ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  async request(endpoint, options = {}) {
    const timeoutMs = options.timeoutMs || 6000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timer);
        return null;
      }
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const url = `${this.URL}/rest/v1/${endpoint}`;
      const headers = { ...this.getHeaders(), ...(options.headers || {}) };
      const fetchOpts = { ...options };
      delete fetchOpts.timeoutMs;
      fetchOpts.headers = headers;
      fetchOpts.signal = controller.signal;

      const response = await fetch(url, fetchOpts);
      clearTimeout(timer);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      if (response.status === 204) return true;
      const text = await response.text();
      try {
        return text ? JSON.parse(text) : true;
      } catch (_) {
        return text;
      }
    } catch (err) {
      clearTimeout(timer);
      console.warn('Supabase request notice (using local):', err.message);
      return null;
    }
  },

  // ---------------- CATEGORIES ----------------
  _getDefaultCategories() {
    return [
      { id: "cat-groceries",   name: "Groceries & Provisions",       sort_order: 1,  image_url: "assets/categories/cat-groceries.png" },
      { id: "cat-phones",      name: "Phones",                       sort_order: 2,  image_url: "assets/categories/cat-phones.png" },
      { id: "cat-computers",   name: "Computers",                    sort_order: 3,  image_url: "assets/categories/cat-computers.png" },
      { id: "cat-electronics", name: "Electronics",                  sort_order: 4,  image_url: "assets/categories/cat-electronics.png" },
      { id: "cat-properties",  name: "Properties",                   sort_order: 5,  image_url: "assets/categories/cat-properties.png" },
      { id: "cat-land",        name: "Land",                         sort_order: 6,  image_url: "assets/categories/cat-land.png" },
      { id: "cat-vehicles",    name: "Vehicles",                     sort_order: 7,  image_url: "assets/categories/cat-vehicles.png" },
      { id: "cat-tricycles",   name: "Tricycles & Transportation",   sort_order: 8,  image_url: "assets/categories/cat-tricycles.png" },
      { id: "cat-inverters",   name: "Buses & Inverters",            sort_order: 9,  image_url: "assets/categories/cat-inverters.png" },
      { id: "cat-building",    name: "Building Materials",           sort_order: 10, image_url: "assets/categories/cat-building.png" },
      { id: "cat-services",    name: "Services & Cleaning",          sort_order: 11, image_url: "assets/categories/cat-services.png" },
      { id: "cat-clothes",     name: "Fashion (Clothes & Shoes)",    sort_order: 12, image_url: "assets/categories/cat-clothes.png" },
      { id: "cat-beauty",      name: "Beauty & Ladies Attire",       sort_order: 13, image_url: "assets/categories/cat-beauty.png" },
      { id: "cat-babies",      name: "Babies & Kids",                sort_order: 14, image_url: "assets/categories/cat-babies.png" },
      { id: "cat-agriculture", name: "Agricultural & Farming",       sort_order: 15, image_url: "assets/categories/cat-agriculture.png" },
      { id: "cat-animals",     name: "Animals & Pets",               sort_order: 16, image_url: "assets/categories/cat-animals.png" },
      { id: "cat-jobs",        name: "Jobs",                         sort_order: 17, image_url: "assets/categories/cat-jobs.png" },
      { id: "cat-handbags",    name: "Hand Bags & Luggage",          sort_order: 18, image_url: "assets/categories/cat-handbags.png" },
      { id: "cat-baggage",     name: "Baggage",                      sort_order: 19, image_url: "assets/categories/cat-baggage.png" }
    ];
  },

  getLocalCategories() {
    try {
      const local = localStorage.getItem('nkem_local_categories');
      let list = local ? JSON.parse(local) : this._getDefaultCategories();
      if (Array.isArray(list)) {
        list = list.filter(c => c && c.id !== 'cat-suits');
        const clothes = list.find(c => c && c.id === 'cat-clothes');
        if (clothes && clothes.name !== 'Fashion (Clothes & Shoes)') {
          clothes.name = 'Fashion (Clothes & Shoes)';
        }
      }
      return list;
    } catch (e) {
      return this._getDefaultCategories();
    }
  },

  async getCategories() {
    const cloud = await this.request('nkem_categories?select=*&order=sort_order.asc');
    if (cloud && Array.isArray(cloud) && cloud.length > 0) {
      const filtered = cloud.filter(c => c && c.id !== 'cat-suits');
      const clothes = filtered.find(c => c && c.id === 'cat-clothes');
      if (clothes && clothes.name !== 'Fashion (Clothes & Shoes)') {
        clothes.name = 'Fashion (Clothes & Shoes)';
      }
      localStorage.setItem('nkem_local_categories', JSON.stringify(filtered));
      return filtered;
    }
    const local = localStorage.getItem('nkem_local_categories');
    return this.getLocalCategories();
  },

  async saveCategory(cat) {
    let localList = await this.getCategories();
    const idx = localList.findIndex(c => c.id === cat.id);
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...cat };
    } else {
      localList.push(cat);
    }
    localStorage.setItem('nkem_local_categories', JSON.stringify(localList));

    // Sync to Supabase
    await this.request('nkem_categories', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(cat)
    });
    return cat;
  },

  async deleteCategory(id) {
    let localList = await this.getCategories();
    localList = localList.filter(c => c.id !== id);
    localStorage.setItem('nkem_local_categories', JSON.stringify(localList));

    await this.request(`nkem_categories?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return true;
  },

  // ---------------- PRODUCTS ----------------
  _getDefaultProducts() {
    return [
      {
        id: 'prod-italian-suit-01',
        title: 'Italian Bespoke Wool Tailored Suit',
        description: 'These particular suits are authentic Italian bespoke cuts, crafted with premium high-twist wool blend fabric for exceptional drape, comfort, and structure. Designed with classic notch lapels, flap pockets, soft interior lining, and dual side vents. Meticulously finished for modern executives and high-profile occasions.',
        price: 300000,
        category_id: 'cat-clothes',
        in_stock: true,
        is_hidden: false,
        images: [
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.37_PM.jpeg',
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.38_PM.jpeg',
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.39_PM_1.jpeg',
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.39_PM.jpeg',
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.40_PM.jpeg',
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.41_PM_1.jpeg',
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.41_PM.jpeg',
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.42_PM_1.jpeg',
          'assets/products/WhatsApp_Image_2026-11-03_at_12.36.42_PM.jpeg'
        ],
        sort_order: 1,
        created_at: new Date().toISOString()
      },
      {
        id: 'prod-mercedes-gle-coupe-2019',
        title: 'Mercedes-Benz GLE Coupe (AMG) 2019',
        description: 'This is not just a car, this is a STATEMENT.\n\nColor: Stunning Matte Burgundy / Maroon (Wrapped)\nEngine: 3.0L V6 Bi-Turbo Petrol - 367HP\nDrive: 4MATIC All-Wheel Drive\nGearbox: 9-Speed Automatic\n\nFEATURES:\n- Panoramic Sunroof\n- AMG Diamond Grille & AMG Alloy Wheels\n- AMG Sports Leather Seats\n- Ambient Lighting\n- Burmester Sound System\n- Reverse Camera + Parking Sensors\n- Electric Memory Seats\n- Keyless Entry\n- Side Steps\n\nCONDITION: Tokunbo American spec\nPRICE: ₦69,000,000\nCALL / WHATSAPP: 07042087633\n\nSerious Buyers Only Please. First Come, First Served!',
        price: 69000000,
        category_id: 'cat-vehicles',
        in_stock: true,
        is_hidden: false,
        images: [
          'assets/products/mercedes-benz-gle-coupe-2019.jpg'
        ],
        sort_order: 2,
        created_at: new Date().toISOString()
      }
    ];
  },

  isProductHidden(p) {
    if (!p) return false;
    if (p.is_hidden === true || p.is_hidden === 'true') return true;
    if (p.hidden === true || p.hidden === 'true') return true;
    try {
      const raw = localStorage.getItem('nkem_hidden_product_ids');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.includes(p.id)) return true;
      }
    } catch (_) {}
    return false;
  },

  setProductHidden(productId, isHidden) {
    if (!productId) return;
    try {
      let arr = [];
      const raw = localStorage.getItem('nkem_hidden_product_ids');
      if (raw) arr = JSON.parse(raw) || [];
      const set = new Set(arr);
      if (isHidden) {
        set.add(productId);
      } else {
        set.delete(productId);
      }
      localStorage.setItem('nkem_hidden_product_ids', JSON.stringify(Array.from(set)));
    } catch (_) {}
  },

  getLocalProducts(includeHidden = false) {
    try {
      const raw = localStorage.getItem('nkem_local_products');
      if (raw) {
        let parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const defaults = this._getDefaultProducts();
          let needsUpdate = false;
          parsed = parsed.map(p => {
            if (this.isProductHidden(p)) {
              p.is_hidden = true;
              p.hidden = true;
            }
            if (p.category_id === 'cat-suits') {
              p.category_id = 'cat-clothes';
              needsUpdate = true;
            }
            const currentDesc = p.description || p.desc || p.details || p.product_description || '';
            if (!currentDesc || typeof currentDesc !== 'string' || !currentDesc.trim()) {
              const def = defaults.find(d => d.id === p.id) || defaults[0];
              needsUpdate = true;
              return { ...p, description: (def && def.description) ? def.description : 'These particular suits are authentic Italian bespoke cuts, crafted with premium high-twist wool blend fabric for exceptional drape, comfort, and structure. Designed with classic notch lapels, flap pockets, soft interior lining, and dual side vents. Meticulously finished for modern executives and high-profile occasions.' };
            }
            return p;
          });
          if (needsUpdate) {
            try { localStorage.setItem('nkem_local_products', JSON.stringify(parsed)); } catch (_) {}
          }
          return includeHidden ? parsed : parsed.filter(p => !this.isProductHidden(p));
        }
      }
    } catch (e) {}
    const defs = this._getDefaultProducts();
    return includeHidden ? defs : defs.filter(p => !this.isProductHidden(p));
  },

  async getProducts(options = {}) {
    const limit = typeof options.limit === 'number' ? options.limit : null;
    const offset = typeof options.offset === 'number' ? options.offset : 0;
    const categoryId = options.categoryId || null;
    const sort = options.sort || null;
    const includeHidden = !!options.includeHidden;

    let queryParts = ['select=*'];

    if (!includeHidden) {
      queryParts.push('or=(is_hidden.is.null,is_hidden.eq.false)');
    }

    if (categoryId && categoryId !== 'all') {
      queryParts.push(`category_id=eq.${encodeURIComponent(categoryId)}`);
    }

    if (sort === 'oldest') {
      queryParts.push('order=created_at.asc');
    } else if (sort === 'price_low') {
      queryParts.push('order=price.asc');
    } else if (sort === 'price_high') {
      queryParts.push('order=price.desc');
    } else if (sort === 'name_asc') {
      queryParts.push('order=title.asc');
    } else {
      queryParts.push('order=sort_order.asc,created_at.desc');
    }

    if (limit !== null) {
      queryParts.push(`limit=${limit}`);
      queryParts.push(`offset=${offset}`);
    }

    const endpoint = `nkem_products?${queryParts.join('&')}`;
    const cloud = await this.request(endpoint);

    if (cloud && Array.isArray(cloud)) {
      try {
        let local = [];
        const raw = localStorage.getItem('nkem_local_products');
        if (raw) local = JSON.parse(raw);
        cloud.forEach(p => {
          if (this.isProductHidden(p)) {
            p.is_hidden = true;
            p.hidden = true;
          }
          const idx = local.findIndex(x => x.id === p.id);
          if (idx >= 0) local[idx] = { ...local[idx], ...p };
          else local.push(p);
        });
        localStorage.setItem('nkem_local_products', JSON.stringify(local));
      } catch (_) {}
      return includeHidden ? cloud : cloud.filter(p => !this.isProductHidden(p));
    }

    // Fallback to local storage
    try {
      let local = [];
      const raw = localStorage.getItem('nkem_local_products');
      if (raw) local = JSON.parse(raw);

      if (!local || local.length === 0) {
        local = this._getDefaultProducts();
        localStorage.setItem('nkem_local_products', JSON.stringify(local));
      } else {
        const defaults = this._getDefaultProducts();
        let needsUpdate = false;
        local = local.map(p => {
          if (this.isProductHidden(p)) {
            p.is_hidden = true;
            p.hidden = true;
          }
          const currentDesc = p.description || p.desc || p.details || p.product_description || '';
          if (!currentDesc || typeof currentDesc !== 'string' || !currentDesc.trim()) {
            const def = defaults.find(d => d.id === p.id) || defaults[0];
            needsUpdate = true;
            return { ...p, description: (def && def.description) ? def.description : 'These particular suits are authentic Italian bespoke cuts, crafted with premium high-twist wool blend fabric for exceptional drape, comfort, and structure. Designed with classic notch lapels, flap pockets, soft interior lining, and dual side vents. Meticulously finished for modern executives and high-profile occasions.' };
          }
          return p;
        });
        if (needsUpdate) {
          try { localStorage.setItem('nkem_local_products', JSON.stringify(local)); } catch (_) {}
        }
      }

      let result = [...local];
      if (!includeHidden) {
        result = result.filter(p => !this.isProductHidden(p));
      }
      if (categoryId && categoryId !== 'all') {
        result = result.filter(p => p.category_id === categoryId);
      }
      if (sort === 'oldest') {
        result.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
      } else if (sort === 'price_low') {
        result.sort((a, b) => Number(a.price) - Number(b.price));
      } else if (sort === 'price_high') {
        result.sort((a, b) => Number(b.price) - Number(a.price));
      } else if (sort === 'name_asc') {
        result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else {
        result.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
      }

      if (limit !== null) {
        return result.slice(offset, offset + limit);
      }
      return result;
    } catch (_) {
      return [];
    }
  },

  async saveProduct(prod) {
    const isHidden = Boolean(prod.is_hidden || prod.hidden);
    this.setProductHidden(prod.id, isHidden);

    let localList = [];
    try {
      const stored = localStorage.getItem('nkem_local_products');
      if (stored) localList = JSON.parse(stored);
      if (!Array.isArray(localList) || localList.length === 0) localList = this._getDefaultProducts();
    } catch (_) {
      localList = this._getDefaultProducts();
    }

    const cleanProd = {
      ...prod,
      is_hidden: isHidden,
      hidden: isHidden,
      updated_at: new Date().toISOString()
    };

    const idx = localList.findIndex(p => p.id === cleanProd.id);
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...cleanProd };
    } else {
      localList.push(cleanProd);
    }
    localStorage.setItem('nkem_local_products', JSON.stringify(localList));

    const dbPayload = {
      id: cleanProd.id,
      title: cleanProd.title || '',
      description: cleanProd.description || cleanProd.desc || '',
      price: Number(cleanProd.price) || 0,
      category_id: cleanProd.category_id || null,
      in_stock: cleanProd.in_stock !== false,
      is_hidden: isHidden,
      hidden: isHidden,
      images: Array.isArray(cleanProd.images) ? cleanProd.images : [],
      sort_order: typeof cleanProd.sort_order === 'number' ? cleanProd.sort_order : 0,
      updated_at: cleanProd.updated_at
    };
    if (cleanProd.created_at) dbPayload.created_at = cleanProd.created_at;

    try {
      const patchRes = await this.request(`nkem_products?id=eq.${encodeURIComponent(cleanProd.id)}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(dbPayload)
      });
      if (!patchRes || (Array.isArray(patchRes) && patchRes.length === 0)) {
        await this.request('nkem_products', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(dbPayload)
        });
      }
    } catch (e) {
      console.warn('saveProduct cloud notice:', e);
    }
    return cleanProd;
  },

  async deleteProduct(id) {
    let localList = [];
    try {
      const stored = localStorage.getItem('nkem_local_products');
      if (stored) localList = JSON.parse(stored);
    } catch (_) {}

    localList = localList.filter(p => p.id !== id);
    localStorage.setItem('nkem_local_products', JSON.stringify(localList));

    await this.request(`nkem_products?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return true;
  },

  // ---------------- BANNERS ----------------
  getLocalBanners() {
    try {
      const local = localStorage.getItem('nkem_local_banners');
      if (local) return JSON.parse(local);
    } catch (e) {}
    return [
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
  },

  async getBanners() {
    const cloud = await this.request('nkem_banners?select=*&order=sort_order.asc');
    if (cloud && Array.isArray(cloud) && cloud.length > 0) {
      localStorage.setItem('nkem_local_banners', JSON.stringify(cloud));
      return cloud;
    }
    const local = localStorage.getItem('nkem_local_banners');
    if (local) return JSON.parse(local);

    const defaultBanners = [
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
    localStorage.setItem('nkem_local_banners', JSON.stringify(defaultBanners));
    return defaultBanners;
  },

  async saveBanner(banner) {
    let localList = await this.getBanners();
    const idx = localList.findIndex(b => b.id === banner.id);
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...banner };
    } else {
      localList.push(banner);
    }
    localStorage.setItem('nkem_local_banners', JSON.stringify(localList));

    await this.request('nkem_banners', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(banner)
    });
    return banner;
  },

  async deleteBanner(id) {
    let localList = await this.getBanners();
    localList = localList.filter(b => b.id !== id);
    localStorage.setItem('nkem_local_banners', JSON.stringify(localList));

    await this.request(`nkem_banners?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return true;
  },

  // ---------------- CANONICAL ORDER & CHAT NORMALIZERS ----------------
  canonicalOrderId(o) {
    if (!o) return '';
    if (typeof o === 'string') return o.trim().toLowerCase();
    const raw = o.id || o.order_id || o.order_code || o.retrieval_code || '';
    return String(raw).trim().toLowerCase();
  },

  getOrderStatus(orderId) {
    if (!orderId) return 'pending';
    const clean = this.canonicalOrderId(orderId);
    try {
      const raw = localStorage.getItem('nkem_order_statuses');
      const statuses = raw ? JSON.parse(raw) : {};
      if (statuses && statuses[clean]) return String(statuses[clean]).toLowerCase();
    } catch (e) {}
    try {
      const local = localStorage.getItem('nkem_local_orders');
      const list = local ? JSON.parse(local) : [];
      if (Array.isArray(list)) {
        const found = list.find(o => this.canonicalOrderId(o) === clean);
        if (found && found.status) return String(found.status).toLowerCase();
      }
    } catch (e) {}
    return 'pending';
  },

  setOrderStatus(orderId, newStatus) {
    if (!orderId) return;
    const clean = this.canonicalOrderId(orderId);
    const s = String(newStatus || 'pending').toLowerCase();
    try {
      const raw = localStorage.getItem('nkem_order_statuses');
      const statuses = raw ? JSON.parse(raw) : {};
      statuses[clean] = s;
      localStorage.setItem('nkem_order_statuses', JSON.stringify(statuses));
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('nkem_order_status_updated', {
        detail: { orderId: clean, status: s }
      }));
    } catch (e) {}
  },

  // One-time clean slate reset requested by user:
  // Clears all test chat history and all test order records, leaving user accounts and catalog products untouched.
  initCleanSlateOnce() {
    const RESET_FLAG = 'nkem_user_and_activities_purged_final';
    if (!localStorage.getItem(RESET_FLAG)) {
      try {
        localStorage.removeItem('nkem_current_user');
        localStorage.removeItem('nkem_local_users');
        localStorage.removeItem('nkem_local_orders');
        localStorage.removeItem('nkem_order_statuses');
        localStorage.removeItem('nkem_active_chat_user');
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('nkem_user_chats_') || k.startsWith('nkem_chats_'))) {
            localStorage.removeItem(k);
          }
        }
        localStorage.setItem(RESET_FLAG, 'true');
        console.log('Nkem Global: User and all activities purged cleanly from local storage.');
      } catch (e) {}
    }
  },

  async clearOrdersAndChats() {
    try {
      localStorage.removeItem('nkem_local_orders');
      localStorage.removeItem('nkem_order_statuses');
      localStorage.removeItem('nkem_active_chat_user');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('nkem_user_chats_') || k.startsWith('nkem_chats_'))) {
          localStorage.removeItem(k);
        }
      }
      try {
        await Promise.all([
          this.request('nkem_orders?id=not.is.null', { method: 'DELETE' }),
          this.request('nkem_chats?id=not.is.null', { method: 'DELETE' })
        ]);
      } catch (cloudErr) {}
      try {
        window.dispatchEvent(new CustomEvent('nkem_order_status_updated', { detail: {} }));
      } catch (e) {}
      return true;
    } catch (e) {
      return false;
    }
  },

  normalizeOrderRecord(o, extra = {}) {
    if (!o) return null;
    const rawId = (o.id || o.order_id || o.order_code || o.retrieval_code || extra.id || `ord-${Date.now()}`).toString().trim();
    const deliveryAddr = o.delivery_address || o.address || extra.delivery_address || extra.address || '';
    let state = o.state || extra.state || '';
    let lga = o.lga || extra.lga || '';
    if ((!state || !lga) && deliveryAddr.includes(',')) {
      const parts = deliveryAddr.split(',').map(s => s.trim()).filter(Boolean);
      if (!state && parts.length >= 2) state = parts[parts.length - 1].replace(/\s+state$/i, '');
      if (!lga && parts.length >= 2) lga = parts[parts.length - 2];
    }
    const rawName = [o.first_name, o.last_name].filter(Boolean).join(' ') || extra.user_name || o.user_name || 'Customer';
    const nameParts = rawName.trim().split(/\s+/);
    const firstName = o.first_name || nameParts[0] || 'Customer';
    const lastName = o.last_name || nameParts.slice(1).join(' ') || '';
    const phone = o.whatsapp_number || o.phone || o.user_whatsapp || extra.user_whatsapp || extra.whatsapp_number || '';
    const email = o.email || o.user_email || extra.email || null;
    const price = Number(o.product_price) || 0;
    const status = String(o.status || 'pending').toLowerCase();
    let image = o.product_image || extra.product_image || o.image || extra.image || '';
    const title = o.product_title || extra.product_title || 'Product Item';

    // Auto-resolve real product image from product catalog if missing or generic
    if (!image || image.includes('logo.png') || image.includes('logo.jpeg')) {
      try {
        const prods = this.getLocalProducts ? this.getLocalProducts(true) : [];
        const match = (prods || []).find(p => {
          if (o.product_id && p.id === o.product_id) return true;
          if (title && p.title) {
            const cleanT = title.toLowerCase().replace(/\s*\(qty:\s*\d+\)/i, '').trim();
            const cleanP = p.title.toLowerCase().trim();
            return cleanT === cleanP || cleanT.includes(cleanP) || cleanP.includes(cleanT);
          }
          return false;
        });
        if (match && Array.isArray(match.images) && match.images[0]) {
          image = match.images[0];
        }
      } catch (_) {}
    }
    if (!image) image = 'assets/images/logo.png';

    return {
      ...o,
      id: rawId,
      order_id: rawId,
      retrieval_code: rawId,
      product_id: o.product_id || extra.product_id || null,
      product_title: title,
      product_price: price,
      product_image: image,
      first_name: firstName,
      last_name: lastName,
      whatsapp_number: phone,
      email: email,
      state: state,
      lga: lga,
      address: deliveryAddr,
      delivery_address: deliveryAddr,
      status: status,
      user_id: o.user_id || extra.user_id || null,
      created_at: o.created_at || extra.created_at || new Date().toISOString()
    };
  },

  resolveProductImage(orderOrProduct) {
    if (!orderOrProduct) return 'assets/images/logo.png';
    let img = orderOrProduct.product_image || orderOrProduct.image_url || orderOrProduct.image || '';
    if (Array.isArray(orderOrProduct.images) && orderOrProduct.images[0]) {
      img = orderOrProduct.images[0];
    }
    if (!img || img.includes('logo.png') || img.includes('logo.jpeg')) {
      try {
        const prods = this.getLocalProducts ? this.getLocalProducts(true) : [];
        const match = (prods || []).find(p => {
          if (orderOrProduct.product_id && p.id === orderOrProduct.product_id) return true;
          if (orderOrProduct.id && p.id === orderOrProduct.id) return true;
          const t = (orderOrProduct.product_title || orderOrProduct.title || '').toLowerCase().replace(/\s*\(qty:\s*\d+\)/i, '').trim();
          const pt = (p.title || '').toLowerCase().trim();
          return t && pt && (t === pt || t.includes(pt) || pt.includes(t));
        });
        if (match && Array.isArray(match.images) && match.images[0]) {
          return match.images[0];
        }
      } catch (_) {}
    }
    return img || 'assets/images/logo.png';
  },

  // ---------------- ORDERS ----------------
  isSourcingOrder(o) {
    if (!o) return false;
    const pid = String(o.product_id || '').toLowerCase();
    const id = String(o.id || o.order_id || '').toLowerCase();
    const code = String(o.retrieval_code || '').toLowerCase();
    const title = String(o.product_title || '').toLowerCase();
    return pid === 'custom-sourcing' || id.startsWith('req-') || id.startsWith('sreq-') || code.startsWith('nkg-req-') || title.startsWith('sourcing request:');
  },

  getLocalOrders() {
    const chatOrdersMap = new Map();

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nkem_user_chats_')) {
          const userIdFromKey = key.replace('nkem_user_chats_', '');
          const raw = localStorage.getItem(key);
          if (raw && (raw.includes('[ORDER_CARD]::') || raw.includes('"order_data"'))) {
            const msgs = JSON.parse(raw);
            if (Array.isArray(msgs)) {
              msgs.forEach(m => {
                if (m && m.order_data) {
                  if (this.isSourcingOrder(m.order_data)) return;
                  const norm = this.normalizeOrderRecord(m.order_data, {
                    user_id: m.user_id || userIdFromKey,
                    user_name: m.user_name,
                    user_whatsapp: m.user_whatsapp,
                    created_at: m.created_at
                  });
                  if (this.isSourcingOrder(norm)) return;
                  const cid = this.canonicalOrderId(norm);
                  if (cid) {
                    chatOrdersMap.set(cid, norm);
                  }
                }
              });
            }
          }
        }
      }
    } catch (e) {}

    // Load nkem_local_orders and merge cleanly
    const finalOrdersMap = new Map();

    // 1. Add all chat orders
    chatOrdersMap.forEach((ord, cid) => {
      finalOrdersMap.set(cid, ord);
    });

    // 2. Add and merge all stored local orders (never exclude genuine customer orders!)
    try {
      const local = localStorage.getItem('nkem_local_orders');
      const list = local ? JSON.parse(local) : [];
      if (Array.isArray(list)) {
        list.forEach(item => {
          if (!item || this.isSourcingOrder(item)) return;
          const norm = this.normalizeOrderRecord(item);
          if (this.isSourcingOrder(norm)) return;
          const cid = this.canonicalOrderId(norm);
          if (!cid) return;

          if (finalOrdersMap.has(cid)) {
            const existing = finalOrdersMap.get(cid);
            finalOrdersMap.set(cid, {
              ...norm,
              ...existing,
              status: norm.status || existing.status,
              product_image: (existing.product_image && !existing.product_image.includes('logo.png')) ? existing.product_image : norm.product_image
            });
          } else {
            finalOrdersMap.set(cid, norm);
          }
        });
      }
    } catch (e) {}

    const deduplicated = Array.from(finalOrdersMap.values()).filter(o => !this.isSourcingOrder(o));
    try {
      localStorage.setItem('nkem_local_orders', JSON.stringify(deduplicated));
    } catch (e) {}

    return deduplicated;
  },

  normalizePhone(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
  },

  filterUserOrders(orders, userId, phone, email) {
    if (!Array.isArray(orders)) return [];
    const normPhone = this.normalizePhone(phone);
    const cleanEmail = (email || '').trim().toLowerCase();

    return orders.filter(o => {
      if (!o) return false;
      // 1. Direct user_id match
      if (userId && o.user_id && String(o.user_id) === String(userId)) return true;

      // 2. WhatsApp / Phone match (normalized digits)
      if (normPhone) {
        const oNormPhone = this.normalizePhone(o.whatsapp_number || o.phone || o.user_whatsapp);
        if (oNormPhone && (oNormPhone === normPhone || oNormPhone.endsWith(normPhone) || normPhone.endsWith(oNormPhone))) return true;
      }

      // 3. Email match
      if (cleanEmail && (o.email || o.user_email)) {
        if (String(o.email || o.user_email).trim().toLowerCase() === cleanEmail) return true;
      }

      // 4. Session match: If order was created on this browser session and user has no other conflicting id
      if (!o.user_id && !normPhone && !cleanEmail) return true;

      return false;
    });
  },

  getUserOrdersSync(userId, phone, email) {
    const userOrdersMap = new Map();

    // 1. Check chat messages for this user
    if (userId) {
      try {
        const chatMsgs = this.getUserChatMessagesSync(userId);
        chatMsgs.forEach(m => {
          if (m && m.order_data) {
            const norm = this.normalizeOrderRecord(m.order_data, {
              user_id: userId,
              user_name: m.user_name,
              user_whatsapp: m.user_whatsapp || phone,
              created_at: m.created_at
            });
            const cid = this.canonicalOrderId(norm);
            if (cid) userOrdersMap.set(cid, norm);
          }
        });
      } catch (e) {}
    }

    // 2. Filter from all local orders (matching userId OR phone OR email)
    const all = this.getLocalOrders();
    const filtered = this.filterUserOrders(all, userId, phone, email);
    filtered.forEach(o => {
      const norm = this.normalizeOrderRecord(o, { user_id: userId });
      const cid = this.canonicalOrderId(norm);
      if (cid) {
        if (userOrdersMap.has(cid)) {
          const existing = userOrdersMap.get(cid);
          userOrdersMap.set(cid, {
            ...norm,
            ...existing,
            status: norm.status || existing.status,
            product_image: (existing.product_image && !existing.product_image.includes('logo.png')) ? existing.product_image : norm.product_image
          });
        } else {
          userOrdersMap.set(cid, norm);
        }
      }
    });

    return Array.from(userOrdersMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  },

  async getOrders(timeoutMs = 3000) {
    const local = this.getLocalOrders();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const cloud = await this.request('nkem_orders?select=*&order=created_at.desc', { signal: controller.signal, timeoutMs });
      clearTimeout(timer);
      if (cloud && Array.isArray(cloud)) {
        const orderMap = new Map();

        // Add local validated orders first
        local.forEach(loc => {
          const cid = this.canonicalOrderId(loc);
          if (cid) orderMap.set(cid, loc);
        });

        // Merge all cloud orders
        cloud.forEach(c => {
          if (this.isSourcingOrder(c)) return;
          const norm = this.normalizeOrderRecord(c);
          const cid = this.canonicalOrderId(norm);
          if (cid) {
            if (orderMap.has(cid)) {
              const existing = orderMap.get(cid);
              orderMap.set(cid, {
                ...existing,
                ...norm,
                status: norm.status || existing.status,
                product_image: (norm.product_image && !norm.product_image.includes('logo.png')) ? norm.product_image : (existing.product_image || norm.product_image)
              });
            } else {
              orderMap.set(cid, norm);
            }
          }
        });

        const merged = Array.from(orderMap.values());
        localStorage.setItem('nkem_local_orders', JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Network getOrders notice (using local):', err);
    }
    return local;
  },

  async getOrderByCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    const cloud = await this.request(`nkem_orders?retrieval_code=eq.${encodeURIComponent(cleanCode)}&select=*`);
    if (cloud && Array.isArray(cloud) && cloud.length > 0) {
      return cloud[0];
    }
    const orders = await this.getOrders();
    return orders.find(o => o.retrieval_code && o.retrieval_code.toUpperCase() === cleanCode) || null;
  },

  async getUserOrders(userId, phone, email, timeoutMs = 3500) {
    const local = this.getUserOrdersSync(userId, phone, email);
    try {
      const orClauses = [];
      if (userId) {
        orClauses.push(`user_id.eq.${encodeURIComponent(userId)}`);
      }
      if (phone) {
        const last10 = this.normalizePhone(phone);
        if (last10) {
          orClauses.push(`whatsapp_number.ilike.*${encodeURIComponent(last10)}*`);
        }
      }
      if (email && email.trim()) {
        orClauses.push(`email.eq.${encodeURIComponent(email.trim().toLowerCase())}`);
      }

      if (orClauses.length === 0) return local;

      const cloudOrdersMap = new Map();
      const filterParam = orClauses.length > 1 ? `or=(${orClauses.join(',')})` : orClauses[0];
      const res = await this.request(`nkem_orders?${filterParam}&order=created_at.desc`, { timeoutMs });

      if (Array.isArray(res)) {
        res.forEach(o => {
          if (this.isSourcingOrder(o)) return;
          const norm = this.normalizeOrderRecord(o, { user_id: userId });
          const cid = this.canonicalOrderId(norm);
          if (cid) cloudOrdersMap.set(cid, norm);
        });
      }

      if (cloudOrdersMap.size > 0) {
        let allLocal = this.getLocalOrders();
        cloudOrdersMap.forEach((cloudOrd, cid) => {
          const idx = allLocal.findIndex(l => this.canonicalOrderId(l) === cid);
          if (idx >= 0) {
            allLocal[idx] = { ...allLocal[idx], ...cloudOrd };
          } else {
            allLocal.unshift(cloudOrd);
          }
        });
        localStorage.setItem('nkem_local_orders', JSON.stringify(allLocal));

        // Return combined list for this user directly!
        const mergedUserOrders = new Map();
        local.forEach(o => {
          const cid = this.canonicalOrderId(o);
          if (cid) mergedUserOrders.set(cid, o);
        });
        cloudOrdersMap.forEach((o, cid) => {
          const existing = mergedUserOrders.get(cid) || {};
          mergedUserOrders.set(cid, {
            ...existing,
            ...o,
            product_image: (o.product_image && !o.product_image.includes('logo.png')) ? o.product_image : (existing.product_image || o.product_image)
          });
        });
        return Array.from(mergedUserOrders.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }
    } catch (err) {
      console.warn('Targeted getUserOrders notice (using local):', err);
    }
    return local;
  },

  async createOrder(orderData) {
    const norm = this.normalizeOrderRecord(orderData);
    let localList = this.getLocalOrders();
    const cid = this.canonicalOrderId(norm);
    localList = localList.filter(o => this.canonicalOrderId(o) !== cid);
    localList.unshift(norm);
    localStorage.setItem('nkem_local_orders', JSON.stringify(localList));

    const payload = {
      id: norm.id,
      retrieval_code: norm.retrieval_code,
      product_id: norm.product_id,
      product_title: norm.product_title,
      product_price: norm.product_price,
      first_name: norm.first_name,
      last_name: norm.last_name,
      whatsapp_number: norm.whatsapp_number,
      email: norm.email || null,
      state: norm.state,
      lga: norm.lga,
      address: norm.address,
      status: norm.status || 'pending',
      created_at: norm.created_at || new Date().toISOString(),
      user_id: norm.user_id || null
    };

    try {
      await this.request('nkem_orders', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Supabase createOrder notice, order saved in local cache:', err);
    }
    return norm;
  },

  async updateOrderStatus(orderId, newStatus) {
    const cleanId = this.canonicalOrderId(orderId);
    const bareCleanId = cleanId.replace(/^#|^ord-/i, '');
    
    // Save to persistent status dictionary & dispatch custom event
    this.setOrderStatus(orderId, newStatus);

    let localList = this.getLocalOrders();
    localList = localList.map(o => {
      const ocid = this.canonicalOrderId(o);
      const bareOcid = ocid.replace(/^#|^ord-/i, '');
      if (ocid === cleanId || bareOcid === bareCleanId) {
        return { ...o, status: newStatus };
      }
      return o;
    });
    localStorage.setItem('nkem_local_orders', JSON.stringify(localList));

    // Also update any chat messages stored in localStorage containing this order
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nkem_user_chats_')) {
          const raw = localStorage.getItem(key);
          if (raw && (raw.toLowerCase().includes(bareCleanId) || raw.includes('[ORDER_CARD]:::'))) {
            let msgs = JSON.parse(raw);
            let changed = false;
            if (Array.isArray(msgs)) {
              msgs = msgs.map(m => {
                if (m && m.order_data) {
                  const mCid = this.canonicalOrderId(m.order_data);
                  const bareMcid = mCid.replace(/^#|^ord-/i, '');
                  if (mCid === cleanId || bareMcid === bareCleanId) {
                    m.order_data.status = newStatus;
                    changed = true;
                  }
                }
                return m;
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(msgs));
              }
            }
          }
        }
      }
    } catch (e) {}

    try {
      await this.request(`nkem_orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.warn('Supabase updateOrderStatus notice, order status updated locally:', err);
    }

    return true;
  },

  async cancelUserOrder(orderId, userId) {
    let localList = await this.getOrders();
    const order = localList.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found.');
    if (order.status !== 'pending') {
      throw new Error(`Order is already ${order.status} and cannot be cancelled.`);
    }

    return await this.updateOrderStatus(orderId, 'cancelled');
  },

  // ---------------- CHAT MESSAGES ----------------
  async getChatMessages(orderCode) {
    if (!orderCode) return [];
    const cleanCode = orderCode.trim().toUpperCase();
    const cloud = await this.request(`nkem_chats?order_code=eq.${encodeURIComponent(cleanCode)}&order=created_at.asc`);
    if (cloud && Array.isArray(cloud)) {
      localStorage.setItem(`nkem_chats_${cleanCode}`, JSON.stringify(cloud));
      return cloud;
    }
    const local = localStorage.getItem(`nkem_chats_${cleanCode}`);
    return local ? JSON.parse(local) : [];
  },

  async sendChatMessage(msg) {
    const cleanCode = msg.order_code.trim().toUpperCase();
    let localList = await this.getChatMessages(cleanCode);
    localList.push(msg);
    localStorage.setItem(`nkem_chats_${cleanCode}`, JSON.stringify(localList));

    await this.request('nkem_chats', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(msg)
    });
    return msg;
  },

  async updateChatMessage(id, fields) {
    const validCols = [
      'message',
      'is_edited',
      'deleted_for_everyone',
      'deleted_for_user',
      'deleted_for_admin',
      'is_read_by_admin',
      'is_read_by_user'
    ];
    const patchBody = { updated_at: new Date().toISOString() };
    for (const key of Object.keys(fields || {})) {
      if (validCols.includes(key)) {
        patchBody[key] = fields[key];
      }
    }

    // Update local caches across both user chat and legacy keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('nkem_chats_') || key.startsWith('nkem_user_chats_'))) {
        try {
          let list = JSON.parse(localStorage.getItem(key) || '[]');
          const idx = list.findIndex(m => m.id === id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...fields, updated_at: patchBody.updated_at };
            localStorage.setItem(key, JSON.stringify(list));
          }
        } catch (e) {}
      }
    }

    await this.request(`nkem_chats?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patchBody)
    });
    return true;
  },

  // ---------------- USER AUTHENTICATION & MANAGEMENT ----------------
  getCurrentUser() {
    const u = localStorage.getItem('nkem_current_user');
    return u ? JSON.parse(u) : null;
  },

  getActiveUser() {
    return this.getCurrentUser();
  },

  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem('nkem_current_user');
    } else {
      localStorage.setItem('nkem_current_user', JSON.stringify(user));
    }
    // Dispatch custom event for reactive UI updates across pages
    window.dispatchEvent(new CustomEvent('nkem_auth_changed', { detail: { user } }));
  },

  setActiveUser(user) {
    return this.setCurrentUser(user);
  },

  logoutUser() {
    this.setCurrentUser(null);
  },

  async getUsers() {
    const cloud = await this.request('nkem_users?select=*&order=created_at.desc');
    if (cloud && Array.isArray(cloud)) {
      const customers = cloud.filter(u => u.id !== 'usr-admin-master' && u.email !== 'admin@nkem.global' && u.whatsapp_number !== 'admin');
      localStorage.setItem('nkem_local_users', JSON.stringify(customers));
      return customers;
    }
    const local = localStorage.getItem('nkem_local_users');
    const parsed = local ? JSON.parse(local) : [];
    return parsed.filter(u => u.id !== 'usr-admin-master' && u.email !== 'admin@nkem.global' && u.whatsapp_number !== 'admin');
  },

  async signUpUser(userData) {
    const rawWhatsapp = (userData.whatsapp_number || '').trim();
    const cleanWhatsapp = rawWhatsapp.replace(/\s+/g, '');
    const normWhatsapp = this.normalizePhone(rawWhatsapp);
    const cleanEmail = (userData.email || '').trim().toLowerCase();

    // Check existing phone and email on database
    const users = await this.getUsers();
    const existingPhone = users.find(u => {
      const uClean = (u.whatsapp_number || '').trim().replace(/\s+/g, '');
      const uNorm = this.normalizePhone(u.whatsapp_number);
      return uClean === cleanWhatsapp || (normWhatsapp && uNorm && normWhatsapp === uNorm);
    });
    if (existingPhone) {
      throw new Error('An account with this WhatsApp phone number already exists. Please sign in instead.');
    }

    if (cleanEmail) {
      const existingEmail = users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
      if (existingEmail) {
        throw new Error('An account with this email address already exists. Please sign in or use another email.');
      }
    }

    const newUser = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      first_name: (userData.first_name || '').trim(),
      last_name: (userData.last_name || '').trim(),
      whatsapp_number: cleanWhatsapp,
      email: cleanEmail || null,
      state: (userData.state || '').trim(),
      lga: (userData.lga || '').trim(),
      address: (userData.address || '').trim(),
      password_hash: userData.password, // Plain text as requested for admin view
      created_at: new Date().toISOString()
    };

    // Save locally
    users.unshift(newUser);
    localStorage.setItem('nkem_local_users', JSON.stringify(users));

    // Save to Supabase
    await this.request('nkem_users', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(newUser)
    });

    // Auto-login
    this.setCurrentUser(newUser);
    return newUser;
  },

  async updateUserProfile(userId, profileData) {
    const users = await this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User account not found.');

    const cleanWhatsapp = (profileData.whatsapp_number || '').trim().replace(/\s+/g, '');
    const cleanEmail = (profileData.email || '').trim().toLowerCase();

    // Enforce uniqueness if phone changed
    if (cleanWhatsapp && cleanWhatsapp !== (users[idx].whatsapp_number || '').replace(/\s+/g, '')) {
      const dupPhone = users.find(u => u.id !== userId && (u.whatsapp_number || '').trim().replace(/\s+/g, '') === cleanWhatsapp);
      if (dupPhone) throw new Error('This WhatsApp phone number is already registered to another account.');
    }

    // Enforce uniqueness if email changed
    if (cleanEmail && cleanEmail !== (users[idx].email || '').trim().toLowerCase()) {
      const dupEmail = users.find(u => u.id !== userId && (u.email || '').trim().toLowerCase() === cleanEmail);
      if (dupEmail) throw new Error('This email address is already registered to another account.');
    }

    const updatedUser = {
      ...users[idx],
      first_name: (profileData.first_name || users[idx].first_name).trim(),
      last_name: (profileData.last_name || users[idx].last_name).trim(),
      whatsapp_number: cleanWhatsapp || users[idx].whatsapp_number,
      email: cleanEmail || null,
      state: (profileData.state || users[idx].state).trim(),
      lga: (profileData.lga || users[idx].lga).trim(),
      address: (profileData.address || users[idx].address).trim()
    };

    users[idx] = updatedUser;
    localStorage.setItem('nkem_local_users', JSON.stringify(users));

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser(updatedUser);
    }

    const dbPayload = {
      first_name: updatedUser.first_name,
      last_name: updatedUser.last_name,
      whatsapp_number: updatedUser.whatsapp_number,
      email: updatedUser.email,
      state: updatedUser.state,
      lga: updatedUser.lga,
      address: updatedUser.address
    };

    await this.request(`nkem_users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(dbPayload)
    });

    return updatedUser;
  },

  async changeUserPassword(userId, oldPassword, newPassword) {
    if (!userId) throw new Error('User ID is required.');
    const cleanOld = String(oldPassword || '').trim();
    const cleanNew = String(newPassword || '').trim();

    if (!cleanOld) throw new Error('Please enter your current password.');
    if (!cleanNew || cleanNew.length < 6) throw new Error('New password must be at least 6 characters.');
    if (cleanNew === cleanOld) throw new Error('New password must be different from current password.');

    let users = await this.getUsers();
    let idx = users.findIndex(u => u.id === userId);

    if (idx === -1) {
      const cur = this.getCurrentUser();
      if (cur && cur.id === userId) {
        users.unshift(cur);
        idx = 0;
      } else {
        throw new Error('User account not found.');
      }
    }

    const currentHash = String(users[idx].password_hash || '').trim();
    if (currentHash !== cleanOld) {
      throw new Error('Current password is incorrect. Please recheck your old password.');
    }

    users[idx].password_hash = cleanNew;
    localStorage.setItem('nkem_local_users', JSON.stringify(users));

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      current.password_hash = cleanNew;
      this.setCurrentUser(current);
    }

    await this.request(`nkem_users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ password_hash: cleanNew })
    });

    return true;
  },

  async signInUser(loginIdentifier, password) {
    const rawId = (loginIdentifier || '').trim();
    const cleanId = rawId.toLowerCase().replace(/\s+/g, '');
    const normPhoneId = this.normalizePhone(rawId);
    const users = await this.getUsers();

    const user = users.find(u => {
      const uRawPhone = (u.whatsapp_number || '').trim();
      const uPhone = uRawPhone.toLowerCase().replace(/\s+/g, '');
      const uNormPhone = this.normalizePhone(uRawPhone);
      const uEmail = (u.email || '').trim().toLowerCase();

      const phoneMatches = (uPhone === cleanId) || (normPhoneId && uNormPhone && normPhoneId === uNormPhone);
      const emailMatches = uEmail && uEmail === cleanId;

      return (phoneMatches || emailMatches) && u.password_hash === password;
    });

    if (!user) {
      throw new Error('Invalid WhatsApp phone number / email or password. Please check your credentials.');
    }

    this.setCurrentUser(user);
    return user;
  },

  // ---------------- USER CLOUD CART SYNC (MULTI-DEVICE) ----------------
  async syncUserCartToCloud(userId, cart) {
    if (!userId) return false;
    const cleanCart = Array.isArray(cart) ? cart.map(i => ({
      id: String(i.id || ''),
      title: String(i.title || ''),
      price: Number(i.price) || 0,
      image: String(i.image || ''),
      category: String(i.category || ''),
      quantity: Math.max(1, Number(i.quantity) || 1)
    })) : [];

    // Immediately keep local storage caches synchronized
    try {
      const curr = this.getCurrentUser();
      if (curr && curr.id === userId) {
        curr.cart = cleanCart;
        localStorage.setItem('nkem_current_user', JSON.stringify(curr));
      }
      const localUsers = JSON.parse(localStorage.getItem('nkem_local_users') || '[]');
      if (Array.isArray(localUsers)) {
        const idx = localUsers.findIndex(u => u.id === userId);
        if (idx !== -1) {
          localUsers[idx].cart = cleanCart;
          localStorage.setItem('nkem_local_users', JSON.stringify(localUsers));
        }
      }
    } catch (_) {}

    try {
      await this.request(`nkem_users?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        keepalive: true,
        headers: {
          'Prefer': 'return=representation',
          'Cache-Control': 'no-cache, no-store'
        },
        body: JSON.stringify({ cart: cleanCart })
      });
      return true;
    } catch (e) {
      console.warn('Cart cloud sync notice:', e);
      return false;
    }
  },

  async getUserCartFromCloud(userId) {
    if (!userId) return null;
    try {
      const res = await this.request(`nkem_users?id=eq.${encodeURIComponent(userId)}&select=cart`, {
        headers: {
          'Cache-Control': 'no-cache, no-store'
        }
      });
      // STRICT FIX: If network failed or timed out, res is null/undefined.
      // Return null so callers NEVER treat network drops as an empty cart!
      if (res === null || res === undefined) {
        return null;
      }
      if (Array.isArray(res) && res.length > 0) {
        return Array.isArray(res[0].cart) ? res[0].cart : [];
      }
      return null;
    } catch (e) {
      console.warn('Cart cloud fetch notice:', e);
      return null;
    }
  },

  // ---------------- DIRECT USER <-> ADMIN CHAT SYSTEM ----------------
  deduplicateChatMessages(msgs) {
    if (!Array.isArray(msgs)) return [];
    const seenMsgIds = new Set();
    const seenOrderRefs = new Set();
    const result = [];

    msgs.forEach(m => {
      if (!m) return;
      if (m.message && typeof m.message === 'string' && m.message.startsWith('[ORDER_CARD]:::') && !m.order_data) {
        try {
          m.order_data = JSON.parse(m.message.slice(15));
          m.message_type = 'order_card';
        } catch (e) {}
      }

      if (m.message && typeof m.message === 'string' && m.message.startsWith('[SOURCING_REQUEST]:::') && !m.sourcing_data) {
        try {
          m.sourcing_data = JSON.parse(m.message.slice(21));
          m.message_type = 'sourcing_request';
        } catch (e) {}
      }

      // If it is an order card, deduplicate by canonical order ID
      if (m.message_type === 'order_card' && m.order_data) {
        const ordRef = this.canonicalOrderId(m.order_data);
        if (ordRef) {
          if (seenOrderRefs.has(ordRef)) return;
          seenOrderRefs.add(ordRef);
        }
      }

      // If it is a sourcing request card, deduplicate by request ID
      if (m.message_type === 'sourcing_request' && m.sourcing_data) {
        const sref = String(m.sourcing_data.request_id || m.id || '').trim().toLowerCase();
        if (sref) {
          if (seenOrderRefs.has(sref)) return;
          seenOrderRefs.add(sref);
        }
      }

      const mid = String(m.id || '').trim();
      if (mid) {
        if (seenMsgIds.has(mid)) return;
        seenMsgIds.add(mid);
      }
      result.push(m);
    });

    return result;
  },

  getUserChatMessagesSync(userId) {
    if (!userId) return [];
    try {
      const local = localStorage.getItem(`nkem_user_chats_${userId}`);
      const parsed = local ? JSON.parse(local) : [];
      const decoded = parsed.map(m => {
        if (m.message && typeof m.message === 'string' && m.message.startsWith('[ORDER_CARD]:::') && !m.order_data) {
          try {
            m.order_data = JSON.parse(m.message.slice(15));
            m.message_type = 'order_card';
          } catch (e) {}
        }
        if (m.message && typeof m.message === 'string' && m.message.startsWith('[SOURCING_REQUEST]:::') && !m.sourcing_data) {
          try {
            m.sourcing_data = JSON.parse(m.message.slice(21));
            m.message_type = 'sourcing_request';
          } catch (e) {}
        }
        return m;
      });
      return this.deduplicateChatMessages(decoded);
    } catch (e) {
      return [];
    }
  },

  async getUserChatMessages(userId) {
    if (!userId) return [];
    const cloud = await this.request(`nkem_chats?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`);
    if (cloud && Array.isArray(cloud)) {
      const decoded = cloud.map(m => {
        if (m.message && typeof m.message === 'string' && m.message.startsWith('[ORDER_CARD]:::')) {
          try {
            m.order_data = JSON.parse(m.message.slice(15));
            m.message_type = 'order_card';
          } catch (e) {}
        }
        if (m.message && typeof m.message === 'string' && m.message.startsWith('[SOURCING_REQUEST]:::')) {
          try {
            m.sourcing_data = JSON.parse(m.message.slice(21));
            m.message_type = 'sourcing_request';
          } catch (e) {}
        }
        return m;
      });
      const deduplicated = this.deduplicateChatMessages(decoded);
      localStorage.setItem(`nkem_user_chats_${userId}`, JSON.stringify(deduplicated));
      return deduplicated;
    }
    const local = localStorage.getItem(`nkem_user_chats_${userId}`);
    const parsed = local ? JSON.parse(local) : [];
    const decoded = parsed.map(m => {
      if (m.message && typeof m.message === 'string' && m.message.startsWith('[ORDER_CARD]:::') && !m.order_data) {
        try {
          m.order_data = JSON.parse(m.message.slice(15));
          m.message_type = 'order_card';
        } catch (e) {}
      }
      if (m.message && typeof m.message === 'string' && m.message.startsWith('[SOURCING_REQUEST]:::') && !m.sourcing_data) {
        try {
          m.sourcing_data = JSON.parse(m.message.slice(21));
          m.message_type = 'sourcing_request';
        } catch (e) {}
      }
      return m;
    });
    return this.deduplicateChatMessages(decoded);
  },

  async sendUserChatMessage(msg) {
    const userId = msg.user_id;
    if (!userId) throw new Error('Missing user_id for chat message.');

    // Ensure order_code is NEVER empty (required by nkem_chats schema)
    const cleanOrderCode = msg.order_code || msg.user_id || 'DIRECT';

    // Serialize order_card or sourcing_request data cleanly into message text if present
    let cleanMessage = msg.message || null;
    if (msg.message_type === 'order_card' && msg.order_data) {
      cleanMessage = `[ORDER_CARD]:::${JSON.stringify(msg.order_data)}`;
    } else if (msg.message_type === 'sourcing_request' && msg.sourcing_data) {
      cleanMessage = `[SOURCING_REQUEST]:::${JSON.stringify(msg.sourcing_data)}`;
    }

    // Strict sanitization: ONLY send valid nkem_chats database columns to Supabase
    const cleanPayload = {
      id: msg.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_code: cleanOrderCode,
      user_id: userId,
      user_name: msg.user_name || 'Customer',
      user_whatsapp: msg.user_whatsapp || '',
      sender: msg.sender || 'user',
      message: cleanMessage,
      image_url: msg.image_url || null,
      is_edited: Boolean(msg.is_edited),
      is_read_by_admin: Boolean(msg.is_read_by_admin),
      is_read_by_user: Boolean(msg.is_read_by_user),
      deleted_for_everyone: Boolean(msg.deleted_for_everyone),
      deleted_for_user: Boolean(msg.deleted_for_user),
      deleted_for_admin: Boolean(msg.deleted_for_admin),
      created_at: msg.created_at || new Date().toISOString()
    };

    // Save to local cache preserving decoded in-memory structure
    const memoryMsg = {
      ...cleanPayload,
      message_type: msg.message_type || (cleanMessage && cleanMessage.startsWith('[ORDER_CARD]:::') ? 'order_card' : (cleanMessage && cleanMessage.startsWith('[SOURCING_REQUEST]:::') ? 'sourcing_request' : undefined)),
      order_data: msg.order_data || undefined,
      sourcing_data: msg.sourcing_data || undefined
    };

    let localList = this.getUserChatMessagesSync(userId);
    const newOrdRef = memoryMsg.order_data ? this.canonicalOrderId(memoryMsg.order_data) : '';
    const newSourcingRef = memoryMsg.sourcing_data ? (memoryMsg.sourcing_data.request_id || memoryMsg.id) : '';

    const existingIdx = localList.findIndex(m => {
      if (m.id === memoryMsg.id) return true;
      if (newOrdRef && m.message_type === 'order_card' && m.order_data) {
        return this.canonicalOrderId(m.order_data) === newOrdRef;
      }
      if (newSourcingRef && m.message_type === 'sourcing_request' && m.sourcing_data) {
        return (m.sourcing_data.request_id || m.id) === newSourcingRef;
      }
      return false;
    });

    if (existingIdx >= 0) {
      localList[existingIdx] = { ...localList[existingIdx], ...memoryMsg };
    } else {
      localList.push(memoryMsg);
    }
    localList = this.deduplicateChatMessages(localList);
    localStorage.setItem(`nkem_user_chats_${userId}`, JSON.stringify(localList));

    // Send strictly sanitized payload to Supabase
    await this.request('nkem_chats', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(cleanPayload)
    });

    return memoryMsg;
  },

  async markChatReadByUser(userId) {
    if (!userId) return;
    let localList = await this.getUserChatMessages(userId);
    let updated = false;
    localList.forEach(m => {
      if (m.sender === 'admin' && !m.is_read_by_user) {
        m.is_read_by_user = true;
        updated = true;
      }
    });
    if (updated) {
      localStorage.setItem(`nkem_user_chats_${userId}`, JSON.stringify(localList));
    }

    await this.request(`nkem_chats?user_id=eq.${encodeURIComponent(userId)}&sender=eq.admin&is_read_by_user=eq.false`, {
      method: 'PATCH',
      body: JSON.stringify({ is_read_by_user: true })
    });
  },

  async markChatReadByAdmin(userId) {
    if (!userId) return;
    let localList = await this.getUserChatMessages(userId);
    let updated = false;
    localList.forEach(m => {
      if (m.sender === 'user' && !m.is_read_by_admin) {
        m.is_read_by_admin = true;
        updated = true;
      }
    });
    if (updated) {
      localStorage.setItem(`nkem_user_chats_${userId}`, JSON.stringify(localList));
    }

    await this.request(`nkem_chats?user_id=eq.${encodeURIComponent(userId)}&sender=eq.user&is_read_by_admin=eq.false`, {
      method: 'PATCH',
      body: JSON.stringify({ is_read_by_admin: true })
    });
  },

  async getUnreadCountForUser(userId) {
    if (!userId) return 0;
    // Free-tier optimization: lightweight query selects ONLY id, eliminating payload transfers
    const cloud = await this.request(
      `nkem_chats?user_id=eq.${encodeURIComponent(userId)}&sender=eq.admin&is_read_by_user=eq.false&deleted_for_everyone=eq.false&deleted_for_user=eq.false&select=id`
    );
    if (cloud && Array.isArray(cloud)) {
      return cloud.length;
    }
    const local = localStorage.getItem(`nkem_user_chats_${userId}`);
    if (local) {
      try {
        const msgs = JSON.parse(local);
        return msgs.filter(m => m.sender === 'admin' && !m.is_read_by_user && !m.deleted_for_everyone && !m.deleted_for_user).length;
      } catch (e) {}
    }
    return 0;
  },

  async getAllCustomerConversations() {
    // Admin helper: fetches recent conversation messages with limit to conserve free-tier bandwidth
    const cloud = await this.request('nkem_chats?order=created_at.desc&limit=100');
    let allMsgs = (cloud && Array.isArray(cloud)) ? cloud : [];

    // Also include any local chats from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('nkem_user_chats_')) {
        try {
          const localItems = JSON.parse(localStorage.getItem(key) || '[]');
          localItems.forEach(item => {
            if (!allMsgs.find(m => m.id === item.id)) {
              allMsgs.push(item);
            }
          });
        } catch (e) {}
      }
    }

    // Decode [ORDER_CARD]::: and deduplicate all messages
    allMsgs = this.deduplicateChatMessages(allMsgs);

    // Also fetch users to have full names even if no chats yet
    const users = await this.getUsers();
    const map = new Map();

    users.forEach(u => {
      map.set(u.id, {
        userId: u.id,
        userName: `${u.first_name} ${u.last_name}`,
        userWhatsapp: u.whatsapp_number,
        userEmail: u.email,
        userLocation: `${u.lga}, ${u.state}`,
        latestMessage: 'No messages yet',
        latestTime: u.created_at,
        unreadCount: 0,
        messages: []
      });
    });

    allMsgs.forEach(m => {
      if (!m.user_id) return;
      let conv = map.get(m.user_id);
      if (!conv) {
        conv = {
          userId: m.user_id,
          userName: m.user_name || 'Customer',
          userWhatsapp: m.user_whatsapp || '',
          userEmail: '',
          userLocation: '',
          latestMessage: '',
          latestTime: m.created_at,
          unreadCount: 0,
          messages: []
        };
        map.set(m.user_id, conv);
      }
      conv.messages.push(m);
      if (m.sender === 'user' && !m.is_read_by_admin && !m.deleted_for_everyone) {
        conv.unreadCount++;
      }
    });

    // Populate latest message & sort by latest activity
    const list = Array.from(map.values()).map(c => {
      c.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      if (c.messages.length > 0) {
        const last = c.messages[c.messages.length - 1];
        if (last.deleted_for_everyone) {
          c.latestMessage = 'This message was deleted';
        } else if (last.message_type === 'order_card' && last.order_data) {
          c.latestMessage = `[Order Request: ${last.order_data.product_title || 'Item'}]`;
        } else if (last.message_type === 'sourcing_request' && last.sourcing_data) {
          c.latestMessage = `[Sourcing Request: ${last.sourcing_data.item || 'Item'}]`;
        } else if (last.image_url) {
          c.latestMessage = '[Image attachment]';
        } else {
          c.latestMessage = last.message || 'Direct Message';
        }
        c.latestTime = last.created_at;
      }
      return c;
    });

    list.sort((a, b) => new Date(b.latestTime || 0) - new Date(a.latestTime || 0));
    return list;
  },

  async purgeDeletedChatMessages() {
    // Permanently removes messages marked deleted_for_everyone=true from Supabase to reclaim storage
    await this.request('nkem_chats?deleted_for_everyone=eq.true', {
      method: 'DELETE'
    });
    return true;
  },

  async getAdminCredentialsCloud() {
    try {
      const records = await this.request('nkem_users?id=eq.usr-admin-master&select=*');
      if (records && records.length > 0 && records[0].password_hash) {
        const creds = {
          username: 'admin',
          password: records[0].password_hash
        };
        localStorage.setItem('nkem_admin_credentials', JSON.stringify(creds));
        return creds;
      } else {
        // Master admin record doesn't exist yet, seed it directly in Supabase
        const defaultAdmin = {
          id: 'usr-admin-master',
          first_name: 'Administrator',
          last_name: 'System',
          whatsapp_number: 'admin',
          email: 'admin@nkem.global',
          state: 'Headquarters',
          lga: 'HQ',
          address: 'Master Admin Console',
          password_hash: 'admin123',
          created_at: new Date().toISOString()
        };
        await this.request('nkem_users', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(defaultAdmin)
        });
        const creds = { username: 'admin', password: 'admin123' };
        localStorage.setItem('nkem_admin_credentials', JSON.stringify(creds));
        return creds;
      }
    } catch (e) {
      console.warn('Supabase getAdminCredentialsCloud fallback:', e);
    }
    // Fallback to local storage or defaults
    try {
      const local = localStorage.getItem('nkem_admin_credentials');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && parsed.username && parsed.password) return parsed;
      }
    } catch (e) {}
    return { username: 'admin', password: 'admin123' };
  },

  async updateAdminPasswordCloud(newPassword) {
    const cleanPass = String(newPassword).trim();
    if (!cleanPass) throw new Error('Password cannot be empty.');
    if (cleanPass.length < 6) throw new Error('New password must be at least 6 characters.');

    // 1. Update master admin record in Supabase
    await this.request('nkem_users?id=eq.usr-admin-master', {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ password_hash: cleanPass })
    });

    // 2. Cache in local storage
    const creds = { username: 'admin', password: cleanPass };
    localStorage.setItem('nkem_admin_credentials', JSON.stringify(creds));
    return creds;
  }
};

// Clean slate initialization on startup
try {
  if (window.SupabaseService && typeof window.SupabaseService.initCleanSlateOnce === 'function') {
    window.SupabaseService.initCleanSlateOnce();
  }
} catch (e) {}

// Universal helper to resolve crisp product images across user store, admin, and chat bubbles
window.resolveProductImage = function(item) {
  if (window.SupabaseService && typeof window.SupabaseService.resolveProductImage === 'function') {
    return window.SupabaseService.resolveProductImage(item);
  }
  if (!item) return 'assets/images/logo.png';
  let img = item.product_image || item.image_url || item.image || '';
  if (Array.isArray(item.images) && item.images[0]) img = item.images[0];
  return img || 'assets/images/logo.png';
};
