// Dedicated Customer Live Chat Controller
// Direct Customer <-> Admin Communication (Zero Retrieval Codes, Real-Time Cloud Sync)

document.addEventListener('DOMContentLoaded', async () => {
  let currentUser = window.SupabaseService.getCurrentUser();
  let pollInterval = null;
  let activeMessages = [];

  // DOM Elements
  const chatActiveCard = document.getElementById('chatActiveCard');
  const chatAuthGateCard = document.getElementById('chatAuthGateCard');
  const chatMessagesList = document.getElementById('chatMessagesList');
  const chatMsgInput = document.getElementById('chatMsgInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatHiddenFileInput = document.getElementById('chatHiddenFileInput');
  const chatImageUploadBtn = document.getElementById('chatImageUploadBtn');
  const chatUserBadge = document.getElementById('chatUserBadge');
  const headerAuthContainer = document.getElementById('headerAuthContainer');
  const fullViewLightbox = document.getElementById('fullViewLightbox');

  // Gate Buttons
  const gateSignInBtn = document.getElementById('gateSignInBtn');
  const gateSignUpBtn = document.getElementById('gateSignUpBtn');

  if (gateSignInBtn) {
    gateSignInBtn.addEventListener('click', () => {
      window.AuthModal.showSignIn((user) => onAuthSuccess(user));
    });
  }

  if (gateSignUpBtn) {
    gateSignUpBtn.addEventListener('click', () => {
      window.AuthModal.showSignUp((user) => onAuthSuccess(user));
    });
  }

  window.addEventListener('nkem_auth_changed', (e) => {
    currentUser = e.detail.user;
    updateAuthView();
  });

  function onAuthSuccess(user) {
    currentUser = user;
    updateAuthView();
  }

  function updateAuthView() {
    if (!currentUser) {
      if (pollInterval) clearInterval(pollInterval);
      chatActiveCard.style.display = 'none';
      chatAuthGateCard.style.display = 'flex';
      renderHeaderAuth();
      return;
    }

    chatAuthGateCard.style.display = 'none';
    chatActiveCard.style.display = 'flex';
    renderHeaderAuth();
    renderChatUserBadge();

    // 0ms INSTANT LOCAL RENDER: Load cached conversation immediately so screen never hangs
    if (window.SupabaseService && window.SupabaseService.getUserChatMessagesSync) {
      const cached = window.SupabaseService.getUserChatMessagesSync(currentUser.id);
      if (cached && cached.length > 0) {
        activeMessages = cached;
        renderChatMessages();
      }
    }

    // Background cloud sync
    loadMessagesAndSync();

    if (pollInterval) clearInterval(pollInterval);
    // Free-tier bandwidth protection: poll every 5s ONLY when tab is focused
    pollInterval = setInterval(() => {
      if (!document.hidden && currentUser) {
        loadMessagesAndSync();
      }
    }, 5000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && currentUser) {
        loadMessagesAndSync();
      }
    });
  }

  function renderHeaderAuth() {
    if (!headerAuthContainer) return;
    if (!currentUser) {
      headerAuthContainer.innerHTML = `
        <button class="btn btn-secondary btn-sm" type="button" id="headerSignInBtn">
          <span>Sign In</span>
        </button>
      `;
      headerAuthContainer.querySelector('#headerSignInBtn').addEventListener('click', () => {
        window.AuthModal.showSignIn((u) => onAuthSuccess(u));
      });
    } else {
      headerAuthContainer.innerHTML = `
        <div class="user-pill" style="cursor: pointer;" id="headerUserPill" title="View Profile & Settings">
          <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="user-pill-name">${window.CustomModal.escape(currentUser.first_name)}</span>
          <button class="btn-pill-logout" type="button" id="headerLogoutBtn" title="Logout">Logout</button>
        </div>
      `;
      headerAuthContainer.querySelector('.user-pill-name').addEventListener('click', (e) => {
        e.stopPropagation();
        window.AuthModal.showProfile();
      });
      headerAuthContainer.querySelector('#headerLogoutBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        window.CustomModal.confirm({
          title: 'Sign Out',
          message: 'Are you sure you want to sign out of your Nkem Global account?',
          confirmText: 'Sign Out',
          onConfirm: () => {
            window.SupabaseService.logoutUser();
            window.CustomModal.toast({ message: 'Signed out successfully.', type: 'info' });
          }
        });
      });
    }
  }

  function renderChatUserBadge() {
    if (!chatUserBadge || !currentUser) return;
    chatUserBadge.innerHTML = `
      <span style="font-size: var(--font-xs); color: #5a6e62;">Signed in as:</span>
      <span style="font-size: var(--font-xs); font-weight: 700; color: #073b1f; background: #e8f7ee; padding: 3px 8px; border: 1px solid #c2e8d0; border-radius: 999px;">
        ${window.CustomModal.escape(currentUser.first_name)} (${window.CustomModal.escape(currentUser.whatsapp_number)})
      </span>
    `;
  }

  /* ---------------- LOAD & SYNC MESSAGES ---------------- */
  async function loadMessagesAndSync() {
    if (!currentUser) return;
    try {
      const msgs = await window.SupabaseService.getUserChatMessages(currentUser.id);
      activeMessages = msgs || [];
      renderChatMessages();

      // Automatically mark any incoming admin messages as read
      await window.SupabaseService.markChatReadByUser(currentUser.id);
    } catch (err) {
      console.warn('Sync warning:', err);
    }
  }

  function renderChatMessages() {
    if (!chatMessagesList) return;

    // Filter out messages deleted for user
    const visibleRaw = activeMessages.filter(m => !m.deleted_for_user);

    // Deduplicate messages by id, and for order cards by canonical order ID
    const seenMsgIds = new Set();
    const seenOrderRefs = new Set();
    const visible = [];

    visibleRaw.forEach(msg => {
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
      visible.push(msg);
    });

    if (visible.length === 0) {
      chatMessagesList.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted); font-size: var(--font-sm);">
          <div style="width: 48px; height: 48px; margin: 0 auto 12px auto; color: var(--accent-gold); display: flex; align-items: center; justify-content: center; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            ${window.renderIcon('chat')}
          </div>
          <p style="font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Welcome to Nkem Global Support, ${window.CustomModal.escape(currentUser.first_name)}!</p>
          <p>Send a message below to inquire about Italian suits, delivery rates, or existing orders. Admin is online to assist you.</p>
        </div>
      `;
      return;
    }

    const isAtBottom = chatMessagesList.scrollHeight - chatMessagesList.scrollTop <= chatMessagesList.clientHeight + 100;

    chatMessagesList.innerHTML = visible.map(msg => {
      const isOutgoing = msg.sender === 'user';
      const isDeletedEveryone = !!msg.deleted_for_everyone;
      const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      // Special Order Card Bubble
      if (msg.message_type === 'order_card' && msg.order_data && !isDeletedEveryone) {
        const ord = msg.order_data;
        const ordId = ord.order_id || ord.id;
        window._chatOrdersMap = window._chatOrdersMap || {};
        window._chatOrdersMap[msg.id] = ord;
        if (ordId) window._chatOrdersMap[ordId] = ord;

        // Check latest live order status dynamically (0ms registry lookup)
        let status = 'pending';
        if (window.SupabaseService && window.SupabaseService.getOrderStatus) {
          status = window.SupabaseService.getOrderStatus(ordId);
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

        return `
          <div class="chat-msg-row ${isOutgoing ? 'outgoing' : 'incoming'}" data-msg-id="${msg.id}">
            <div class="chat-order-card-bubble" data-msg-id="${msg.id}" data-order-id="${ord.order_id}" title="Click to view full order details & download receipt" onclick="window.handleOrderBubbleClick(this, '${ord.order_id}', '${msg.id}', false);">
              <div class="chat-order-card-header">
                <span class="chat-order-card-tag">
                  <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                  CUSTOMER ORDER REQUEST
                </span>
                <span class="chat-order-card-badge ${statusClass}">${statusLabel}</span>
              </div>

              <div class="chat-order-card-content">
                <img src="${ord.product_image || 'assets/images/logo.jpeg'}" class="chat-order-card-thumb" alt="${window.CustomModal.escape(ord.product_title || 'Product')}" onclick="event.stopPropagation(); openLightbox('${ord.product_image || 'assets/images/logo.jpeg'}')" />
                <div class="chat-order-card-info">
                  <h4 class="chat-order-card-title">${window.CustomModal.escape(ord.product_title || 'Order')}</h4>
                  <div class="chat-order-card-price">${window.formatNaira(ord.product_price || 0)}</div>
                  <div class="chat-order-card-ref">Order ID: <strong>${ord.order_id}</strong></div>
                  ${cleanAddr ? `<div class="chat-order-card-addr">Delivery: ${window.CustomModal.escape(cleanAddr)}</div>` : ''}
                </div>
              </div>

              <div class="chat-order-card-footer" style="display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--accent-gold); font-size: 11px; font-weight: 600; cursor: pointer;" onclick="event.stopPropagation(); window.handleOrderBubbleClick(this, '${ord.order_id}', '${msg.id}', false);">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Tap to view order details &amp; download receipt</span>
              </div>
            </div>

            <div class="chat-msg-meta">
              <span>${timeStr}</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="chat-msg-row ${isOutgoing ? 'outgoing' : 'incoming'}" data-msg-id="${msg.id}">
          <div class="chat-bubble">
            ${isDeletedEveryone ? `
              <em style="color: var(--text-muted); font-size: var(--font-xs);">This message was deleted</em>
            ` : `
              ${msg.message ? `<div style="white-space: pre-wrap;">${window.CustomModal.escape(msg.message)}</div>` : ''}
              ${msg.image_url ? `
                <img class="chat-msg-image" src="${msg.image_url}" alt="Attachment" onclick="openLightbox('${msg.image_url}')" />
              ` : ''}
            `}
          </div>

          <div class="chat-msg-meta">
            <span>${timeStr}</span>
            ${msg.is_edited && !isDeletedEveryone ? `<span style="font-style: italic;">(edited)</span>` : ''}

            ${!isDeletedEveryone ? `
              <span class="chat-msg-actions-btn" title="Message Options" onclick="openMessageActions('${msg.id}', ${isOutgoing})">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to all order card chat bubbles
    chatMessagesList.querySelectorAll('.chat-order-card-bubble').forEach(card => {
      card.addEventListener('click', (e) => {
        // Prevent modal if user clicked directly on thumbnail to view photo
        if (e.target.closest('.chat-order-card-thumb')) return;
        const msgId = card.getAttribute('data-msg-id');
        const ordId = card.getAttribute('data-order-id');
        if (window.handleOrderBubbleClick) {
          window.handleOrderBubbleClick(card, ordId, msgId, false);
        } else {
          const orderData = (window._chatOrdersMap && (window._chatOrdersMap[msgId] || window._chatOrdersMap[ordId])) || { order_id: ordId };
          if (window.openChatOrderDetailsModal) {
            window.openChatOrderDetailsModal(orderData, false);
          }
        }
      });
    });

    if (isAtBottom) {
      chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
    }
  }

  /* ---------------- SEND MESSAGE ---------------- */
  async function sendMessage() {
    if (!currentUser) return;
    const text = (chatMsgInput.value || '').trim();
    if (!text) return;

    chatSendBtn.disabled = true;

    const msgObj = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      order_code: currentUser.id,
      user_id: currentUser.id,
      user_name: `${currentUser.first_name} ${currentUser.last_name}`,
      user_whatsapp: currentUser.whatsapp_number,
      sender: 'user',
      message: text,
      image_url: null,
      is_edited: false,
      is_read_by_admin: false,
      is_read_by_user: true,
      deleted_for_everyone: false,
      deleted_for_user: false,
      deleted_for_admin: false,
      created_at: new Date().toISOString()
    };

    chatMsgInput.value = '';
    activeMessages.push(msgObj);
    renderChatMessages();
    chatMessagesList.scrollTop = chatMessagesList.scrollHeight;

    try {
      await window.SupabaseService.sendUserChatMessage(msgObj);
    } catch (err) {
      console.warn('Send error:', err);
    } finally {
      chatSendBtn.disabled = false;
      chatMsgInput.focus();
    }
  }

  if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendMessage);
  }

  if (chatMsgInput) {
    chatMsgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  /* ---------------- IMAGE UPLOAD (AUTO COMPRESSED TO <= 100KB) ---------------- */
  if (chatImageUploadBtn && chatHiddenFileInput) {
    chatImageUploadBtn.addEventListener('click', () => {
      chatHiddenFileInput.click();
    });

    chatHiddenFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !currentUser) return;

      window.CustomModal.toast({ message: 'Compressing image to <= 100KB...', type: 'info' });

      try {
        const compressed = await window.ImageCompressor.compress(file);

        const msgObj = {
          id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          order_code: currentUser.id,
          user_id: currentUser.id,
          user_name: `${currentUser.first_name} ${currentUser.last_name}`,
          user_whatsapp: currentUser.whatsapp_number,
          sender: 'user',
          message: null,
          image_url: compressed.dataUrl,
          is_edited: false,
          is_read_by_admin: false,
          is_read_by_user: true,
          deleted_for_everyone: false,
          deleted_for_user: false,
          deleted_for_admin: false,
          created_at: new Date().toISOString()
        };

        activeMessages.push(msgObj);
        renderChatMessages();
        chatMessagesList.scrollTop = chatMessagesList.scrollHeight;

        await window.SupabaseService.sendUserChatMessage(msgObj);
        window.CustomModal.toast({
          message: `Image sent (${compressed.sizeKb} KB - optimized under 100KB)`,
          type: 'success'
        });
      } catch (err) {
        window.CustomModal.toast({ message: `Image upload failed: ${err.message}`, type: 'danger' });
      }

      chatHiddenFileInput.value = '';
    });
  }

  /* ---------------- MESSAGE ACTIONS (EDIT / DELETE) ---------------- */
  window.openMessageActions = async function(msgId, isOutgoing) {
    const msg = activeMessages.find(m => m.id === msgId);
    if (!msg) return;

    if (isOutgoing) {
      const isEdit = await window.CustomModal.confirm({
        title: 'Message Options',
        message: 'Choose an action for this message:',
        confirmText: 'Edit Message',
        cancelText: 'Delete Options'
      });

      if (isEdit === null) {
        // User closed modal with [X] or clicked backdrop -> abort without action
        return;
      }

      if (isEdit === true) {
        if (!msg.message) {
          window.CustomModal.toast({ message: 'Only text messages can be edited.', type: 'warning' });
          return;
        }
        const newText = await window.CustomModal.prompt({
          title: 'Edit Message',
          message: 'Update your message content:',
          defaultValue: msg.message
        });

        if (newText !== null && newText.trim() && newText.trim() !== msg.message) {
          await window.SupabaseService.updateChatMessage(msg.id, {
            message: newText.trim(),
            is_edited: true
          });
          msg.message = newText.trim();
          msg.is_edited = true;
          renderChatMessages();
          window.CustomModal.toast({ message: 'Message updated.', type: 'success' });
        }
      } else if (isEdit === false) {
        // User explicitly clicked "Delete Options" button
        const deleteChoice = await window.CustomModal.confirm({
          title: 'Delete Message',
          message: 'How would you like to delete this message?',
          confirmText: 'Delete for Everyone',
          cancelText: 'Delete for Me',
          isDanger: true
        });

        if (deleteChoice === null) {
          // User closed modal with [X] or clicked backdrop -> abort without deleting!
          return;
        }

        if (deleteChoice === true) {
          await window.SupabaseService.updateChatMessage(msg.id, { deleted_for_everyone: true });
          msg.deleted_for_everyone = true;
          renderChatMessages();
          window.CustomModal.toast({ message: 'Deleted for everyone.', type: 'info' });
        } else if (deleteChoice === false) {
          await window.SupabaseService.updateChatMessage(msg.id, { deleted_for_user: true });
          msg.deleted_for_user = true;
          renderChatMessages();
          window.CustomModal.toast({ message: 'Deleted for you.', type: 'info' });
        }
      }
    } else {
      // Incoming admin message: User can delete for me
      const del = await window.CustomModal.confirm({
        title: 'Delete Message',
        message: 'Delete this message for yourself?',
        confirmText: 'Delete for Me',
        cancelText: 'Cancel',
        isDanger: true
      });
      if (del === true) {
        await window.SupabaseService.updateChatMessage(msg.id, { deleted_for_user: true });
        msg.deleted_for_user = true;
        renderChatMessages();
        window.CustomModal.toast({ message: 'Deleted for you.', type: 'info' });
      }
    }
  };

  /* ---------------- FULL VIEW LIGHTBOX (ONLY IMAGE & X UNDER, ZERO TEXT) ---------------- */
  function openFullViewLightbox(imgSrc) {
    if (!fullViewLightbox || !imgSrc) return;

    fullViewLightbox.innerHTML = `
      <div class="full-view-img-container">
        <img class="full-view-img" src="${imgSrc}" alt="" />
      </div>
      <button class="full-view-close-under" type="button" id="closeLightboxUnderBtn" aria-label="Close View">
        ${window.renderIcon('close')}
      </button>
    `;

    const closeBtn = fullViewLightbox.querySelector('#closeLightboxUnderBtn');
    const closeBox = () => {
      fullViewLightbox.classList.remove('active');
      document.removeEventListener('keydown', onEsc);
    };

    const onEsc = (e) => {
      if (e.key === 'Escape') closeBox();
    };
    document.addEventListener('keydown', onEsc);

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeBox();
      });
    }

    fullViewLightbox.addEventListener('click', (e) => {
      if (e.target === fullViewLightbox || e.target.classList.contains('full-view-img-container')) {
        closeBox();
      }
    });

    fullViewLightbox.classList.add('active');
  }

  window.openLightbox = openFullViewLightbox;
  window.openFullViewLightbox = openFullViewLightbox;

  // Smart Top Bar Hide on Scroll Down, Reveal Instantly on the Slightest Scroll Up
  function initSmartHeaderScroll() {
    const headerBar = document.querySelector('.header-bar');
    if (!headerBar) return;

    let lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    let ticking = false;

    function evaluateScroll() {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

      if (currentScrollY <= 40) {
        headerBar.classList.remove('header-hidden');
        lastScrollY = currentScrollY;
        ticking = false;
        return;
      }

      if (currentScrollY < lastScrollY) {
        headerBar.classList.remove('header-hidden');
      } else if (currentScrollY > lastScrollY && currentScrollY > 80) {
        headerBar.classList.add('header-hidden');
      }

      lastScrollY = currentScrollY;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(evaluateScroll);
        ticking = true;
      }
    }, { passive: true });

    window.addEventListener('wheel', (e) => {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (e.deltaY < 0) {
        headerBar.classList.remove('header-hidden');
      } else if (e.deltaY > 0 && currentScrollY > 80) {
        headerBar.classList.add('header-hidden');
      }
    }, { passive: true });
  }

  initSmartHeaderScroll();

  // Live synchronization of order status updates & order card bubbles
  window.addEventListener('nkem_order_status_updated', () => {
    if (activeUserId) {
      renderChatMessages();
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'nkem_order_statuses' || e.key === 'nkem_local_orders' || (e.key && e.key.startsWith('nkem_user_chats_'))) {
      if (activeUserId) {
        renderChatMessages();
      }
    }
  });

  // Mobile keyboard handling: keep messages pinned to bottom on resize/focus
  function setupMobileKeyboardAvoidance() {
    const scrollToBottom = () => {
      if (chatMessagesList) {
        chatMessagesList.scrollTop = chatMessagesList.scrollHeight;
      }
    };

    if (window.visualViewport) {
      const handleVpResize = () => {
        // Keep chat viewport strictly locked above mobile keyboard
        if (window.visualViewport) {
          const vpHeight = window.visualViewport.height;
          if (chatActiveCard) {
            chatActiveCard.style.height = `${vpHeight}px`;
          }
          document.body.style.height = `${vpHeight}px`;
        }
        scrollToBottom();
      };
      window.visualViewport.addEventListener('resize', handleVpResize);
      window.visualViewport.addEventListener('scroll', scrollToBottom);
    }

    if (chatMsgInput) {
      chatMsgInput.addEventListener('focus', () => {
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
        setTimeout(scrollToBottom, 300);
      });
    }
  }

  setupMobileKeyboardAvoidance();

  // Initial Boot
  updateAuthView();
});
