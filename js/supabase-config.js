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
    const timeoutMs = options.timeoutMs || 3500;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const signal = options.signal || controller.signal;

    try {
      const url = `${this.URL}/rest/v1/${endpoint}`;
      const headers = { ...this.getHeaders(), ...(options.headers || {}) };
      const response = await fetch(url, { ...options, headers, signal });
      clearTimeout(timer);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      console.warn('Supabase request notice (using local):', err.message);
      return null;
    }
  },

  // ---------------- CATEGORIES ----------------
  getLocalCategories() {
    try {
      const local = localStorage.getItem('nkem_local_categories');
      return local ? JSON.parse(local) : [
        { id: 'cat-suits', name: 'Italian Suits', sort_order: 1 }
      ];
    } catch (e) {
      return [{ id: 'cat-suits', name: 'Italian Suits', sort_order: 1 }];
    }
  },

  async getCategories() {
    const cloud = await this.request('nkem_categories?select=*&order=sort_order.asc');
    if (cloud && Array.isArray(cloud) && cloud.length > 0) {
      localStorage.setItem('nkem_local_categories', JSON.stringify(cloud));
      return cloud;
    }
    const local = localStorage.getItem('nkem_local_categories');
    return local ? JSON.parse(local) : [
      { id: 'cat-suits', name: 'Italian Suits', sort_order: 1 }
    ];
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
        category_id: 'cat-suits',
        in_stock: true,
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
      }
    ];
  },

  getLocalProducts() {
    try {
      const raw = localStorage.getItem('nkem_local_products');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return this._getDefaultProducts();
  },

  async getProducts(options = {}) {
    const limit = typeof options.limit === 'number' ? options.limit : null;
    const offset = typeof options.offset === 'number' ? options.offset : 0;
    const categoryId = options.categoryId || null;
    const sort = options.sort || null;

    let queryParts = ['select=*'];

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
          const idx = local.findIndex(x => x.id === p.id);
          if (idx >= 0) local[idx] = p;
          else local.push(p);
        });
        localStorage.setItem('nkem_local_products', JSON.stringify(local));
      } catch (_) {}
      return cloud;
    }

    // Fallback to local storage
    try {
      let local = [];
      const raw = localStorage.getItem('nkem_local_products');
      if (raw) local = JSON.parse(raw);

      if (!local || local.length === 0) {
        local = this._getDefaultProducts();
        localStorage.setItem('nkem_local_products', JSON.stringify(local));
      }

      let result = [...local];
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
    let localList = [];
    try {
      const stored = localStorage.getItem('nkem_local_products');
      if (stored) localList = JSON.parse(stored);
      if (!Array.isArray(localList) || localList.length === 0) localList = this._getDefaultProducts();
    } catch (_) {
      localList = this._getDefaultProducts();
    }

    const idx = localList.findIndex(p => p.id === prod.id);
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...prod, updated_at: new Date().toISOString() };
    } else {
      localList.push(prod);
    }
    localStorage.setItem('nkem_local_products', JSON.stringify(localList));

    await this.request('nkem_products', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(prod)
    });
    return prod;
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
    const image = o.product_image || extra.product_image || 'assets/images/logo.jpeg';
    const title = o.product_title || extra.product_title || 'Italian Bespoke Wool Tailored Suit';

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

  // ---------------- ORDERS ----------------
  getLocalOrders() {
    // Chat order cards are the definitive source of truth for genuine customer orders
    const chatOrdersMap = new Map();
    const chatUserIds = new Set();
    const chatPhones = new Set();
    const chatEmails = new Set();

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nkem_user_chats_')) {
          const userIdFromKey = key.replace('nkem_user_chats_', '');
          if (userIdFromKey) chatUserIds.add(userIdFromKey);
          const raw = localStorage.getItem(key);
          if (raw && (raw.includes('[ORDER_CARD]::') || raw.includes('"order_data"'))) {
            const msgs = JSON.parse(raw);
            if (Array.isArray(msgs)) {
              msgs.forEach(m => {
                if (m && m.order_data) {
                  const norm = this.normalizeOrderRecord(m.order_data, {
                    user_id: m.user_id || userIdFromKey,
                    user_name: m.user_name,
                    user_whatsapp: m.user_whatsapp,
                    created_at: m.created_at
                  });
                  const cid = this.canonicalOrderId(norm);
                  if (cid) {
                    chatOrdersMap.set(cid, norm);
                    if (norm.user_id) chatUserIds.add(String(norm.user_id));
                    if (norm.whatsapp_number) {
                      const p = this.normalizePhone(norm.whatsapp_number);
                      if (p) chatPhones.add(p);
                    }
                    if (norm.email) chatEmails.add(norm.email.trim().toLowerCase());
                  }
                }
              });
            }
          }
        }
      }
    } catch (e) {}

    // Load nkem_local_orders
    const finalOrdersMap = new Map();

    // 1. First add all authentic chat orders (definitive source of truth)
    chatOrdersMap.forEach((ord, cid) => {
      finalOrdersMap.set(cid, ord);
    });

    // 2. Scan nkem_local_orders and prune orphan/phantom orders
    try {
      const local = localStorage.getItem('nkem_local_orders');
      const list = local ? JSON.parse(local) : [];
      if (Array.isArray(list)) {
        list.forEach(item => {
          if (!item) return;
          const norm = this.normalizeOrderRecord(item);
          const cid = this.canonicalOrderId(norm);
          if (!cid) return;

          // If this order is in chatOrdersMap, merge fields (such as updated status)
          if (finalOrdersMap.has(cid)) {
            const existing = finalOrdersMap.get(cid);
            finalOrdersMap.set(cid, {
              ...existing,
              ...norm,
              status: norm.status || existing.status
            });
          } else {
            // Check if this order claims to belong to a customer who has chat history:
            // If the user HAS chat orders, but this order is NOT in their chat orders,
            // it is a phantom/stale order and MUST BE EXCLUDED!
            const itemUserId = norm.user_id ? String(norm.user_id) : '';
            const itemPhone = norm.whatsapp_number ? this.normalizePhone(norm.whatsapp_number) : '';
            const itemEmail = norm.email ? norm.email.trim().toLowerCase() : '';

            const belongsToChatUser = (
              (itemUserId && chatUserIds.has(itemUserId)) ||
              (itemPhone && chatPhones.has(itemPhone)) ||
              (itemEmail && chatEmails.has(itemEmail))
            );

            // If it belongs to a user who already has genuine chat orders, DO NOT add phantom orders!
            if (belongsToChatUser && chatOrdersMap.size > 0) {
              return; // Exclude phantom order!
            }

            // Only keep if from an entirely different user with no chat record
            if (!belongsToChatUser) {
              finalOrdersMap.set(cid, norm);
            }
          }
        });
      }
    } catch (e) {}

    const deduplicated = Array.from(finalOrdersMap.values());
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

    // 1. Any order found in this user's direct chat cache IS THE AUTHENTIC SOURCE OF TRUTH
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

    // If orders were found in this user's chat, THE CHAT IS THE EXCLUSIVE COMPLETE TRUTH!
    // We do NOT pull phantom orders from local orders that are missing from chat!
    if (userOrdersMap.size > 0) {
      const all = this.getLocalOrders();
      all.forEach(o => {
        const cid = this.canonicalOrderId(o);
        if (userOrdersMap.has(cid)) {
          const chatOrd = userOrdersMap.get(cid);
          userOrdersMap.set(cid, {
            ...chatOrd,
            status: o.status || chatOrd.status
          });
        }
      });
      return Array.from(userOrdersMap.values());
    }

    // 2. Only if the user has NO orders in chat at all, fallback to filtering local orders
    const all = this.getLocalOrders();
    const filtered = this.filterUserOrders(all, userId, phone, email);
    filtered.forEach(o => {
      const norm = this.normalizeOrderRecord(o, { user_id: userId });
      const cid = this.canonicalOrderId(norm);
      if (cid && !userOrdersMap.has(cid)) {
        userOrdersMap.set(cid, norm);
      }
    });

    return Array.from(userOrdersMap.values());
  },

  async getOrders(timeoutMs = 3000) {
    const local = this.getLocalOrders();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const cloud = await this.request('nkem_orders?select=*&order=created_at.desc', { signal: controller.signal, timeoutMs });
      clearTimeout(timer);
      if (cloud && Array.isArray(cloud)) {
        const localValidIds = new Set(local.map(l => this.canonicalOrderId(l)));
        const orderMap = new Map();

        // Add local validated orders first
        local.forEach(loc => {
          const cid = this.canonicalOrderId(loc);
          if (cid) orderMap.set(cid, loc);
        });

        // Only merge cloud orders that match local or if no local orders existed
        cloud.forEach(c => {
          const norm = this.normalizeOrderRecord(c);
          const cid = this.canonicalOrderId(norm);
          if (cid) {
            if (orderMap.has(cid)) {
              orderMap.set(cid, { ...orderMap.get(cid), ...norm });
            } else if (localValidIds.size === 0) {
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

  async getUserOrders(userId, phone, email, timeoutMs = 2500) {
    const local = this.getUserOrdersSync(userId, phone, email);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let cloud = [];
      if (userId) {
        cloud = await this.request(`nkem_orders?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`, { signal: controller.signal, timeoutMs });
      }
      if ((!cloud || cloud.length === 0) && phone) {
        const cleanPhone = (phone || '').trim().replace(/\D/g, '').replace(/^234/, '0');
        if (cleanPhone) {
          cloud = await this.request(`nkem_orders?whatsapp_number=eq.${encodeURIComponent(cleanPhone)}&order=created_at.desc`, { signal: controller.signal, timeoutMs });
        }
      }
      clearTimeout(timer);

      if (cloud && Array.isArray(cloud) && cloud.length > 0) {
        let localList = this.getLocalOrders();
        cloud.forEach(c => {
          const norm = this.normalizeOrderRecord(c, { user_id: userId });
          const cid = this.canonicalOrderId(norm);
          const idx = localList.findIndex(l => this.canonicalOrderId(l) === cid);
          if (idx >= 0) {
            localList[idx] = { ...localList[idx], ...norm };
          }
        });
        localStorage.setItem('nkem_local_orders', JSON.stringify(localList));
        return this.getUserOrdersSync(userId, phone, email);
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

  setCurrentUser(user) {
    if (!user) {
      localStorage.removeItem('nkem_current_user');
    } else {
      localStorage.setItem('nkem_current_user', JSON.stringify(user));
    }
    // Dispatch custom event for reactive UI updates across pages
    window.dispatchEvent(new CustomEvent('nkem_auth_changed', { detail: { user } }));
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
    const cleanWhatsapp = (userData.whatsapp_number || '').trim().replace(/\s+/g, '');
    const cleanEmail = (userData.email || '').trim().toLowerCase();

    // Check existing phone and email on database
    const users = await this.getUsers();
    const existingPhone = users.find(u => (u.whatsapp_number || '').trim().replace(/\s+/g, '') === cleanWhatsapp);
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
      address: (profileData.address || users[idx].address).trim(),
      updated_at: new Date().toISOString()
    };

    users[idx] = updatedUser;
    localStorage.setItem('nkem_local_users', JSON.stringify(users));

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser(updatedUser);
    }

    await this.request(`nkem_users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(updatedUser)
    });

    return updatedUser;
  },

  async changeUserPassword(userId, oldPassword, newPassword) {
    const users = await this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('User account not found.');

    if (users[idx].password_hash !== oldPassword) {
      throw new Error('Current password is incorrect. Please recheck your old password.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    users[idx].password_hash = newPassword;
    users[idx].updated_at = new Date().toISOString();
    localStorage.setItem('nkem_local_users', JSON.stringify(users));

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser(users[idx]);
    }

    await this.request(`nkem_users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ password_hash: newPassword, updated_at: users[idx].updated_at })
    });

    return true;
  },

  async signInUser(loginIdentifier, password) {
    const cleanId = (loginIdentifier || '').trim().toLowerCase().replace(/\s+/g, '');
    const users = await this.getUsers();

    const user = users.find(u => {
      const uPhone = (u.whatsapp_number || '').trim().toLowerCase().replace(/\s+/g, '');
      const uEmail = (u.email || '').trim().toLowerCase();
      return (uPhone === cleanId || (uEmail && uEmail === cleanId)) && u.password_hash === password;
    });

    if (!user) {
      throw new Error('Invalid WhatsApp phone number / email or password. Please check your credentials.');
    }

    this.setCurrentUser(user);
    return user;
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

      // If it is an order card, deduplicate by canonical order ID
      if (m.message_type === 'order_card' && m.order_data) {
        const ordRef = this.canonicalOrderId(m.order_data);
        if (ordRef) {
          if (seenOrderRefs.has(ordRef)) return;
          seenOrderRefs.add(ordRef);
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
      return m;
    });
    return this.deduplicateChatMessages(decoded);
  },

  async sendUserChatMessage(msg) {
    const userId = msg.user_id;
    if (!userId) throw new Error('Missing user_id for chat message.');

    // Ensure order_code is NEVER empty (required by nkem_chats schema)
    const cleanOrderCode = msg.order_code || msg.user_id || 'DIRECT';

    // Serialize order_card data cleanly into message text if present
    let cleanMessage = msg.message || null;
    if (msg.message_type === 'order_card' && msg.order_data) {
      cleanMessage = `[ORDER_CARD]:::${JSON.stringify(msg.order_data)}`;
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
      message_type: msg.message_type || (cleanMessage && cleanMessage.startsWith('[ORDER_CARD]:::') ? 'order_card' : undefined),
      order_data: msg.order_data || undefined
    };

    let localList = this.getUserChatMessagesSync(userId);
    const newOrdRef = memoryMsg.order_data ? this.canonicalOrderId(memoryMsg.order_data) : '';

    const existingIdx = localList.findIndex(m => {
      if (m.id === memoryMsg.id) return true;
      if (newOrdRef && m.message_type === 'order_card' && m.order_data) {
        return this.canonicalOrderId(m.order_data) === newOrdRef;
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
