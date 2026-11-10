// Receipt Image Generator for Online Orders
// Generates a downloadable image carrying Logo (16:9 Aspect Ratio), Shop Name, Contact Info, and Order Specifications
window.ReceiptGenerator = {
  /**
   * Generates a canvas receipt and downloads it as an image
   */
  async downloadReceiptImage(order) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 800 x 780 high-res receipt
    const w = 800;
    const h = 780;
    canvas.width = w;
    canvas.height = h;

    // Flat Dark Theme Background
    ctx.fillStyle = '#0b0c0e';
    ctx.fillRect(0, 0, w, h);

    // Outer Crisp Border
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // Inner Header Card
    ctx.fillStyle = '#14151a';
    ctx.fillRect(24, 24, w - 48, 150);
    ctx.strokeStyle = '#272a35';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 24, w - 48, 150);

    // Logo drawn in its true 16:9 / 2:1 rectangular aspect ratio (160x80)
    try {
      const logoImg = await this.loadImage('assets/images/logo.png');
      ctx.drawImage(logoImg, 46, 59, 160, 80);
    } catch (e) {
      // Fallback logo box
      ctx.fillStyle = '#000';
      ctx.fillRect(46, 59, 160, 80);
      ctx.fillStyle = '#c5a059';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('NKEM GLOBAL', 52, 108);
    }

    // Shop Title & Subtitle
    const ordRef = (order.id || order.order_id || order.order_code || order.retrieval_code || `ORD-${Date.now()}`).toString().trim().toUpperCase();
    const rawDelivery = order.delivery_address || order.address || '';
    let destState = order.state || order.destination_state || '';
    let destLga = order.lga || '';
    if ((!destState || !destLga) && rawDelivery.includes(',')) {
      const parts = rawDelivery.split(',').map(s => s.trim()).filter(Boolean);
      if (!destState && parts.length >= 2) destState = parts[parts.length - 1].replace(/\s+state$/i, '');
      if (!destLga && parts.length >= 2) destLga = parts[parts.length - 2];
    }
    destState = destState || 'Nigeria';
    destLga = destLga || 'N/A';
    const customerName = [order.first_name, order.last_name].filter(Boolean).join(' ') || order.user_name || order.customer_name || 'Customer';
    const customerPhone = order.whatsapp_number || order.phone || order.user_whatsapp || 'On File';
    const customerEmail = order.email || order.user_email || null;
    const priceNum = Number(order.product_price) || 0;
    const productTitle = order.product_title || 'Italian Bespoke Wool Tailored Suit';
    const placedDate = order.created_at ? new Date(order.created_at).toLocaleString() : new Date().toLocaleString();

    ctx.fillStyle = '#f5f6f8';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('NKEM GLOBAL', 230, 72);

    ctx.fillStyle = '#c5a059';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`OFFICIAL ORDER RECEIPT • #${ordRef}`, 230, 100);

    ctx.fillStyle = '#9da1ad';
    ctx.font = '14px sans-serif';
    ctx.fillText('WhatsApp: +234 815 560 8447  |  Major Line: +234 704 208 7633', 230, 128);

    ctx.fillStyle = '#6d7280';
    ctx.font = '12px sans-serif';
    ctx.fillText('Nationwide Delivery  •  Direct Support', 230, 150);

    // Order Details Section
    let curY = 216;
    ctx.fillStyle = '#f5f6f8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('ORDER SPECIFICATIONS', 40, curY);

    curY += 15;
    ctx.strokeStyle = '#272a35';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, curY);
    ctx.lineTo(w - 40, curY);
    ctx.stroke();

    const drawRow = (label, value) => {
      curY += 38;
      ctx.fillStyle = '#9da1ad';
      ctx.font = '600 16px sans-serif';
      ctx.fillText(label, 40, curY);

      ctx.fillStyle = '#f5f6f8';
      ctx.font = '16px sans-serif';
      ctx.fillText(String(value || 'N/A'), 260, curY);
    };

    drawRow('Order Reference ID:', '#' + ordRef);
    drawRow('Product:', productTitle);
    drawRow('Amount / Price:', window.formatNaira(priceNum));
    drawRow('Customer Name:', customerName);
    drawRow('WhatsApp Number:', customerPhone);
    if (customerEmail) drawRow('Email Address:', customerEmail);
    drawRow('Destination State:', destState);
    drawRow('LGA:', destLga);
    drawRow('Delivery Address:', rawDelivery || 'Address on file');
    drawRow('Order Placed At:', placedDate);

    // Subtle divider above footer
    ctx.strokeStyle = '#272a35';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 670);
    ctx.lineTo(w - 40, 670);
    ctx.stroke();

    // Verification Note
    ctx.fillStyle = '#9da1ad';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Verified Order • Track order status directly via customer account or live chat.', w / 2, 700);

    // Footer note
    ctx.fillStyle = '#6d7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('© Nkem Global — Verified Quality & Nationwide Delivery. All rights reserved.', w / 2, 735);

    // Trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `nkem-global-order-${order.id || Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  },

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
};

/**
 * Universal Chat Order Details & Receipt Modal
 * Opens synchronously in 0ms when customer or admin clicks an order card chat bubble
 */
window.handleOrderBubbleClick = function(cardOrTarget, orderId, msgId, isAdmin = false) {
  try {
    const cleanId = String(orderId || msgId || '').trim().toLowerCase();
    let orderData = null;

    if (window._chatOrdersMap) {
      if (orderId && window._chatOrdersMap[orderId]) orderData = window._chatOrdersMap[orderId];
      else if (msgId && window._chatOrdersMap[msgId]) orderData = window._chatOrdersMap[msgId];
      else {
        for (const k in window._chatOrdersMap) {
          if (k.toLowerCase() === cleanId) {
            orderData = window._chatOrdersMap[k];
            break;
          }
        }
      }
    }

    if (!orderData && window.SupabaseService && window.SupabaseService.getLocalOrders) {
      const localOrders = window.SupabaseService.getLocalOrders();
      orderData = localOrders.find(o => {
        const oid = String(o.id || o.order_id || o.retrieval_code || '').trim().toLowerCase();
        return oid === cleanId;
      });
    }

    if (!orderData && typeof adminState !== 'undefined' && adminState && Array.isArray(adminState.orders)) {
      orderData = adminState.orders.find(o => {
        const oid = String(o.id || o.order_id || o.retrieval_code || '').trim().toLowerCase();
        return oid === cleanId;
      });
    }

    // Deep lookup in localStorage chats if still missing
    if (!orderData) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('nkem_user_chats_')) {
            const raw = localStorage.getItem(key);
            if (raw && (raw.toLowerCase().includes(cleanId) || raw.includes('[ORDER_CARD]:::'))) {
              const list = JSON.parse(raw);
              const foundMsg = list.find(m => {
                if (m.id === msgId) return true;
                if (m.order_data) {
                  const mId = String(m.order_data.order_id || m.order_data.id || '').trim().toLowerCase();
                  return mId === cleanId;
                }
                return false;
              });
              if (foundMsg && foundMsg.order_data) {
                orderData = {
                  ...foundMsg.order_data,
                  user_id: foundMsg.user_id,
                  user_name: foundMsg.user_name,
                  user_whatsapp: foundMsg.user_whatsapp
                };
                break;
              }
            }
          }
        }
      } catch (e) {}
    }

    // Scrape from card DOM element as backup
    const card = (cardOrTarget && cardOrTarget.closest) ? cardOrTarget.closest('.chat-order-card-bubble') : null;
    if (card) {
      const domTitle = card.querySelector('.chat-order-card-title')?.textContent?.trim();
      const domThumb = card.querySelector('.chat-order-card-thumb')?.getAttribute('src');
      const domAddr = card.querySelector('.chat-order-card-addr')?.textContent?.replace(/^Delivery:\s*/i, '').trim();
      const domId = card.getAttribute('data-order-id') || orderId;

      orderData = {
        id: domId,
        order_id: domId,
        product_title: domTitle || 'Italian Bespoke Wool Tailored Suit',
        product_price: 300000,
        product_image: domThumb || 'assets/images/logo.jpeg',
        delivery_address: domAddr || '',
        address: domAddr || '',
        status: 'pending',
        ...orderData
      };
    }

    if (!orderData) {
      orderData = {
        id: orderId || `ord-${Date.now()}`,
        order_id: orderId || `ord-${Date.now()}`,
        product_title: 'Italian Bespoke Wool Tailored Suit',
        product_price: 300000,
        status: 'pending'
      };
    }

    window.openChatOrderDetailsModal(orderData, isAdmin);
  } catch (err) {
    console.error('handleOrderBubbleClick error:', err);
  }
};

window.openChatOrderDetailsModal = function(orderData, isAdmin = false) {
  if (!orderData) {
    console.warn('openChatOrderDetailsModal called with empty orderData');
    return;
  }

  const rawOrderId = (orderData.order_id || orderData.id || orderData.retrieval_code || `ord-${Date.now()}`).toString().trim();
  const cleanId = rawOrderId.toLowerCase();
  const orderId = rawOrderId;
  let fullOrder = { ...orderData, id: rawOrderId, order_id: rawOrderId };

  // Synchronously merge with local cached orders if available (0ms instant access)
  try {
    if (window.SupabaseService && window.SupabaseService.getLocalOrders) {
      const localOrders = window.SupabaseService.getLocalOrders();
      const found = localOrders.find(o => {
        const oid = String(o.id || o.order_id || o.retrieval_code || '').trim().toLowerCase();
        return oid === cleanId;
      });
      if (found) {
        fullOrder = {
          ...found,
          ...fullOrder,
          first_name: fullOrder.first_name || found.first_name || '',
          last_name: fullOrder.last_name || found.last_name || '',
          whatsapp_number: fullOrder.whatsapp_number || found.whatsapp_number || '',
          email: fullOrder.email || found.email || '',
          state: fullOrder.state || found.state || '',
          lga: fullOrder.lga || found.lga || '',
          address: fullOrder.address || found.address || fullOrder.delivery_address || found.delivery_address || '',
          delivery_address: fullOrder.delivery_address || found.delivery_address || fullOrder.address || found.address || '',
          status: found.status || fullOrder.status || 'pending',
          product_price: fullOrder.product_price || found.product_price || 0,
          product_title: fullOrder.product_title || found.product_title || 'Italian Bespoke Wool Tailored Suit',
          product_image: fullOrder.product_image || found.product_image || 'assets/images/logo.jpeg'
        };
      }
    }
    // Also check admin state orders if available
    if (typeof adminState !== 'undefined' && adminState && Array.isArray(adminState.orders)) {
      const adminFound = adminState.orders.find(o => {
        const oid = String(o.id || o.order_id || o.retrieval_code || '').trim().toLowerCase();
        return oid === cleanId;
      });
      if (adminFound) {
        fullOrder = {
          ...adminFound,
          ...fullOrder,
          status: adminFound.status || fullOrder.status || 'pending'
        };
      }
    }
  } catch (e) {
    console.warn('Sync cache merge error:', e);
  }

  // Parse state and LGA if missing
  const deliveryAddr = fullOrder.delivery_address || fullOrder.address || 'Delivery address on file';
  if ((!fullOrder.state || !fullOrder.lga) && deliveryAddr.includes(',')) {
    const parts = deliveryAddr.split(',').map(s => s.trim()).filter(Boolean);
    if (!fullOrder.state && parts.length >= 2) fullOrder.state = parts[parts.length - 1].replace(/\s+state$/i, '');
    if (!fullOrder.lga && parts.length >= 2) fullOrder.lga = parts[parts.length - 2];
  }

  // Remove any existing overlay
  const oldModal = document.getElementById('chatOrderDetailsModalOverlay');
  if (oldModal && oldModal.parentNode) oldModal.parentNode.removeChild(oldModal);

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'c-modal-overlay active';
  modalOverlay.id = 'chatOrderDetailsModalOverlay';
  modalOverlay.style.cssText = 'position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483600 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: rgba(6, 7, 9, 0.94) !important; opacity: 1 !important; pointer-events: auto !important; padding: 16px !important; box-sizing: border-box !important;';

  const getStatusBadge = (st) => {
    const s = String(st || 'pending').toLowerCase();
    if (s === 'pending') return `<span class="order-status-badge status-pending">Pending Review</span>`;
    if (s === 'approved') return `<span class="order-status-badge status-approved">Approved &bull; Confirmed</span>`;
    if (s === 'shipping' || s === 'shipped') return `<span class="order-status-badge status-shipping">In Transit &bull; Shipping</span>`;
    if (s === 'delivered') return `<span class="order-status-badge status-delivered">Delivered Successfully</span>`;
    if (s === 'declined') return `<span class="order-status-badge status-declined">Declined</span>`;
    if (s === 'cancelled') return `<span class="order-status-badge status-cancelled">Cancelled</span>`;
    return `<span class="order-status-badge status-pending">${st || 'Pending'}</span>`;
  };

  const statusBadge = getStatusBadge(fullOrder.status);
  const coverImg = fullOrder.product_image || 'assets/images/logo.jpeg';
  const customerName = `${fullOrder.first_name || ''} ${fullOrder.last_name || ''}`.trim() || fullOrder.user_name || fullOrder.customer_name || 'Customer';
  const dateStr = fullOrder.created_at ? new Date(fullOrder.created_at).toLocaleString() : 'Recently';
  const rawWa = String(fullOrder.whatsapp_number || fullOrder.phone || fullOrder.user_whatsapp || '').trim();
  const waDigits = rawWa.replace(/\D/g, '').replace(/^0+/, '');

  modalOverlay.innerHTML = `
    <div class="c-modal-box" style="max-width: 540px; max-height: 90vh; display: flex; flex-direction: column; width: 100%;">
      <div class="c-modal-header">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <h3 class="c-modal-title" style="font-size: var(--font-base);">Order &amp; Product Details</h3>
          <div id="modalStatusBadgeWrap">${statusBadge}</div>
        </div>
        <button class="c-modal-close-btn" type="button" id="closeChatOrderDetailsBtn" aria-label="Close">
          <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="c-modal-body" style="overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px;">
        <!-- Product Card Box -->
        <div style="display: flex; gap: 14px; padding: 12px; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm); align-items: flex-start;">
          <img src="${coverImg}" alt="${window.CustomModal ? window.CustomModal.escape(fullOrder.product_title || 'Product') : 'Product'}" style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-color); flex-shrink: 0; cursor: pointer;" id="chatOrderModalThumb" title="Click to view full image" />
          <div style="flex: 1; min-width: 0;">
            <h4 style="margin: 0 0 4px 0; font-size: var(--font-sm); color: var(--text-main); font-weight: 700;">${window.CustomModal ? window.CustomModal.escape(fullOrder.product_title || 'Product Item') : fullOrder.product_title}</h4>
            <div style="font-size: var(--font-md); font-weight: 700; color: var(--accent-gold);">${window.formatNaira ? window.formatNaira(fullOrder.product_price || 0) : '₦' + (fullOrder.product_price || 0)}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; font-family: monospace;">Order ID: <strong>${String(orderId || '').toUpperCase()}</strong></div>
          </div>
        </div>

        <!-- Order Specifications Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: var(--font-xs); background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Customer Name</span>
            <strong style="color: var(--text-main); font-size: 13px;">${window.CustomModal ? window.CustomModal.escape(customerName) : customerName}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">WhatsApp Number</span>
            ${waDigits ? `
              <a href="https://wa.me/234${waDigits}" target="_blank" rel="noopener noreferrer" style="color: #25d366; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                <span style="display: inline-flex; align-items: center; font-size: 13px; line-height: 1; color: #25d366;">${window.renderIcon ? window.renderIcon('whatsapp') : ''}</span>
                <span>${window.CustomModal ? window.CustomModal.escape(rawWa) : rawWa}</span>
              </a>
            ` : `<span style="color: var(--text-muted);">N/A</span>`}
          </div>
          ${fullOrder.email ? `
            <div style="grid-column: 1/-1;">
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Email Address</span>
              <strong style="color: var(--text-main);">${window.CustomModal ? window.CustomModal.escape(fullOrder.email) : fullOrder.email}</strong>
            </div>
          ` : ''}
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Destination State</span>
            <strong style="color: var(--text-main);">${window.CustomModal ? window.CustomModal.escape(fullOrder.state || 'N/A') : (fullOrder.state || 'N/A')}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">LGA</span>
            <strong style="color: var(--text-main);">${window.CustomModal ? window.CustomModal.escape(fullOrder.lga || 'N/A') : (fullOrder.lga || 'N/A')}</strong>
          </div>
          <div style="grid-column: 1/-1;">
            <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Delivery Address</span>
            <strong style="color: var(--text-main);">${window.CustomModal ? window.CustomModal.escape(deliveryAddr) : deliveryAddr}</strong>
          </div>
          <div style="grid-column: 1/-1;">
            <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase;">Order Placed At</span>
            <span style="color: var(--text-muted);">${dateStr}</span>
          </div>
        </div>

        <!-- Download Official Receipt Button -->
        <button class="btn btn-primary" type="button" id="chatModalDownloadReceiptBtn" style="width: 100%; justify-content: center; padding: 12px; gap: 8px; font-weight: 700;">
          <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Download Official Receipt Image</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const statusListener = (e) => {
    if (e.detail && e.detail.orderId) {
      const evId = String(e.detail.orderId).trim().toLowerCase();
      const bareEvId = evId.replace(/^#|^ord-/i, '');
      const bareClean = cleanId.replace(/^#|^ord-/i, '');
      if (evId === cleanId || bareEvId === bareClean) {
        fullOrder.status = e.detail.status;
        const badgeWrap = modalOverlay.querySelector('#modalStatusBadgeWrap');
        if (badgeWrap) badgeWrap.innerHTML = getStatusBadge(e.detail.status);
      }
    }
  };
  window.addEventListener('nkem_order_status_updated', statusListener);

  const closeModal = () => {
    window.removeEventListener('nkem_order_status_updated', statusListener);
    if (modalOverlay.parentNode) modalOverlay.parentNode.removeChild(modalOverlay);
  };

  modalOverlay.querySelector('#closeChatOrderDetailsBtn').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Lightbox on thumbnail click
  const thumb = modalOverlay.querySelector('#chatOrderModalThumb');
  if (thumb) {
    thumb.addEventListener('click', () => {
      if (window.openFullViewLightbox) {
        window.openFullViewLightbox(coverImg);
      } else if (window.openLightbox) {
        window.openLightbox(coverImg);
      }
    });
  }

  // Download Receipt Action
  modalOverlay.querySelector('#chatModalDownloadReceiptBtn').addEventListener('click', async () => {
    if (window.ReceiptGenerator && window.ReceiptGenerator.downloadReceiptImage) {
      if (window.CustomModal) {
        window.CustomModal.toast({ message: 'Generating official receipt image...', type: 'info' });
      }
      await window.ReceiptGenerator.downloadReceiptImage(fullOrder);
      if (window.CustomModal) {
        window.CustomModal.toast({ message: 'Official receipt image downloaded!', type: 'success' });
      }
    } else {
      if (window.CustomModal) {
        window.CustomModal.toast({ message: 'Receipt generator is loading. Please retry.', type: 'warning' });
      }
    }
  });

  // Background refresh for latest order updates from Supabase
  if (window.SupabaseService && window.SupabaseService.getOrders) {
    window.SupabaseService.getOrders().then(orders => {
      const bareClean = cleanId.replace(/^#|^ord-/i, '');
      const found = (orders || []).find(o => {
        const oid = String(o.id || o.order_id || o.retrieval_code || '').trim().toLowerCase();
        return oid === cleanId || oid.replace(/^#|^ord-/i, '') === bareClean;
      });
      if (found && modalOverlay.parentNode) {
        fullOrder = { ...fullOrder, ...found };
        const badgeWrap = modalOverlay.querySelector('#modalStatusBadgeWrap');
        if (badgeWrap) badgeWrap.innerHTML = getStatusBadge(found.status);
      }
    }).catch(e => console.warn('Background modal refresh notice:', e));
  }
};

/* ---------------- UNIVERSAL FULL VIEW LIGHTBOX OVERLAY ---------------- */
window.openFullViewLightbox = function(imgSrc) {
  if (!imgSrc) return;
  let box = document.getElementById('fullViewLightbox');
  if (!box) {
    box = document.createElement('div');
    box.className = 'full-view-lightbox';
    box.id = 'fullViewLightbox';
    document.body.appendChild(box);
  }

  // Always move to the end of document.body so it overlays on top of ANY currently open modal!
  document.body.appendChild(box);

  const closeIcon = (window.renderIcon && window.renderIcon('close')) ||
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  box.innerHTML = `
    <div class="full-view-img-container">
      <img class="full-view-img" src="${imgSrc}" alt="Full View" />
    </div>
    <button class="full-view-close-under" type="button" id="closeLightboxUnderBtn" aria-label="Close View">
      ${closeIcon}
    </button>
  `;

  box.style.setProperty('z-index', '2147483647', 'important');
  box.style.setProperty('position', 'fixed', 'important');
  box.style.setProperty('top', '0', 'important');
  box.style.setProperty('left', '0', 'important');
  box.style.setProperty('right', '0', 'important');
  box.style.setProperty('bottom', '0', 'important');
  box.style.setProperty('width', '100vw', 'important');
  box.style.setProperty('height', '100vh', 'important');
  box.style.setProperty('height', '100dvh', 'important');
  box.style.setProperty('display', 'flex', 'important');
  box.style.setProperty('opacity', '1', 'important');
  box.style.setProperty('pointer-events', 'auto', 'important');

  box.classList.add('active');

  const closeBox = () => {
    box.classList.remove('active');
    box.style.removeProperty('display');
    box.style.removeProperty('opacity');
    box.style.removeProperty('pointer-events');
    document.removeEventListener('keydown', onEsc);
  };

  const onEsc = (e) => {
    if (e.key === 'Escape') closeBox();
  };
  document.addEventListener('keydown', onEsc);

  const closeBtn = box.querySelector('#closeLightboxUnderBtn');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeBox();
    };
  }

  box.onclick = (e) => {
    if (e.target === box || e.target.classList.contains('full-view-img-container')) {
      closeBox();
    }
  };
};
window.openLightbox = window.openFullViewLightbox;
