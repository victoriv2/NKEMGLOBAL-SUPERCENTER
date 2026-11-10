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
      if (chatActiveCard) {
        chatActiveCard.style.setProperty('display', 'none', 'important');
        chatActiveCard.classList.add('hidden');
      }
      if (chatAuthGateCard) {
        chatAuthGateCard.style.setProperty('display', 'flex', 'important');
        chatAuthGateCard.classList.remove('hidden');
      }
      renderHeaderAuth();
      return;
    }

    if (chatAuthGateCard) {
      chatAuthGateCard.style.setProperty('display', 'none', 'important');
      chatAuthGateCard.classList.add('hidden');
    }
    if (chatActiveCard) {
      chatActiveCard.style.setProperty('display', 'flex', 'important');
      chatActiveCard.classList.remove('hidden');
    }
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
      if (msg.message_type === 'sourcing_request' && msg.sourcing_data) {
        const sref = String(msg.sourcing_data.request_id || msg.id || '').trim().toLowerCase();
        if (sref) {
          if (seenOrderRefs.has(sref)) return;
          seenOrderRefs.add(sref);
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

      // Special Order Request Card (Matching My Orders exactly)
      if (msg.message_type === 'order_card' && msg.order_data && !isDeletedEveryone) {
        const ord = msg.order_data;
        const ordId = ord.order_id || ord.id || ord.retrieval_code;
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
        status = String(status || 'pending').toLowerCase();

        const code = ord.retrieval_code || ord.order_id || ord.id || 'N/A';
        const dateStr = (ord.created_at || msg.created_at)
          ? new Date(ord.created_at || msg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Recent';

        // Clean up duplicate delivery address tokens
        let cleanAddr = '';
        if (ord.delivery_address || ord.address || ord.destination) {
          const raw = String(ord.delivery_address || ord.address || ord.destination);
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
        if (!cleanAddr && ord.state) {
          cleanAddr = `${ord.lga ? ord.lga + ', ' : ''}${ord.state}`;
        }

        const priceNum = Number(ord.product_price || 0);
        const amountDisplay = priceNum > 0 ? window.formatNaira(priceNum) : 'Quote Pending';
        const productTitle = ord.product_title || 'Custom Order';
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
                <a href="https://wa.me/2348155608447?text=${encodeURIComponent(`Hello Nkem Global, I am inquiring about my request (${code}): ${productTitle}`)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="padding: 6px 12px; font-size: 0.78rem; color: #166534; border-color: #25D366; text-decoration: none;">
                  ${window.renderIcon ? window.renderIcon('whatsapp') : '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>'}
                  <span>WhatsApp Support</span>
                </a>
                <button type="button" class="btn btn-secondary btn-sm chat-req-copy-btn" data-code="${code}" style="padding: 6px 12px; font-size: 0.78rem;">
                  ${window.renderIcon ? window.renderIcon('copy') : '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'}
                  <span>Copy Code</span>
                </button>
              </div>
            </div>

            <div class="chat-msg-meta">
              <span>${timeStr}</span>
            </div>
          </div>
        `;
      }

      // Special Custom Sourcing Request Bubble (Distinct & Differentiated)
      if (msg.message_type === 'sourcing_request' && msg.sourcing_data && !isDeletedEveryone) {
        const src = msg.sourcing_data;
        const itemName = src.item || 'Custom Sourcing Item';
        const userNotes = src.notes || '';
        const dateStr = (src.created_at || msg.created_at)
          ? new Date(src.created_at || msg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Recent';

        return `
          <div class="chat-msg-row ${isOutgoing ? 'outgoing' : 'incoming'}" data-msg-id="${msg.id}">
            <div class="chat-sourcing-request-card" data-msg-id="${msg.id}">
              <div class="sourcing-card-header">
                <span class="sourcing-card-badge">
                  <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  <span>CUSTOM SOURCING REQUEST</span>
                </span>
                <span class="sourcing-card-guarantee">2 Options within 30 Mins</span>
              </div>

              <div class="sourcing-card-body">
                <div class="sourcing-item-eyebrow">Requested Item</div>
                <h4 class="sourcing-item-name">${window.CustomModal.escape(itemName)}</h4>
                
                ${userNotes ? `
                  <div class="sourcing-details-pill">
                    <strong>Target Budget / Notes:</strong> ${window.CustomModal.escape(userNotes)}
                  </div>
                ` : ''}

                <div class="sourcing-meta-line">
                  <span>Submitted on ${dateStr}</span>
                  <span class="sourcing-status-dot">&#9679; Sourcing Active</span>
                </div>
              </div>

              <div class="sourcing-card-actions">
                <a href="https://wa.me/2348155608447?text=${encodeURIComponent(`Hello Nkem Global, I am checking on my sourcing request for: ${itemName}${userNotes ? ` (${userNotes})` : ''}`)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm sourcing-wa-btn">
                  ${window.renderIcon ? window.renderIcon('whatsapp') : '<svg class="svg-icon svg-whatsapp" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;"><path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.275-.101-.476-.15-.676.15-.2.301-.776.978-.952 1.18-.175.2-.351.225-.652.075-.301-.15-1.27-.468-2.42-1.494-.894-.799-1.498-1.786-1.674-2.087-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.151-.175.201-.301.301-.501.1-.2.05-.376-.025-.526-.075-.15-.676-1.63-.926-2.232-.244-.588-.492-.508-.676-.517-.175-.009-.376-.011-.577-.011s-.527.075-.802.376c-.276.301-1.053 1.029-1.053 2.509 0 1.48 1.078 2.91 1.229 3.111.15.2 2.122 3.24 5.141 4.545.718.31 1.278.496 1.716.635.722.23 1.38.197 1.9-.119.58-.354 1.78-1.455 2.03-2.866.25-1.411.25-2.621.175-2.871-.075-.25-.276-.376-.577-.526zM12.04 2C6.51 2 2.03 6.48 2.03 12.01c0 1.98.58 3.82 1.58 5.37L2 22l4.78-1.55c1.5 1 3.29 1.56 5.26 1.56 5.53 0 10.01-4.48 10.01-10.01C22.05 6.48 17.57 2 12.04 2zm0 18.25c-1.72 0-3.32-.51-4.67-1.39l-.33-.22-2.84.92.93-2.77-.24-.35A8.2 8.2 0 0 1 3.83 12c0-4.53 3.68-8.21 8.21-8.21 4.53 0 8.21 3.68 8.21 8.21 0 4.53-3.68 8.25-8.21 8.25z"/></svg>'}
                  <span>Follow up on WhatsApp</span>
                </a>
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

    // Attach action listeners for chat order request cards
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
          window.handleOrderBubbleClick(card, code, msgId, false);
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

    // Move to end of body to ensure it overlays on top of ANY open modal
    document.body.appendChild(fullViewLightbox);

    fullViewLightbox.innerHTML = `
      <div class="full-view-img-container">
        <img class="full-view-img" src="${imgSrc}" alt="" />
      </div>
      <button class="full-view-close-under" type="button" id="closeLightboxUnderBtn" aria-label="Close View">
        ${window.renderIcon ? window.renderIcon('close') : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
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
        const section = document.querySelector('.chat-page-section');
        if (section && window.visualViewport) {
          const kbHeight = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
          section.style.bottom = `${kbHeight}px`;
        }
        scrollToBottom();
      };
      window.visualViewport.addEventListener('resize', handleVpResize);
      window.visualViewport.addEventListener('scroll', handleVpResize);
    }

    if (chatMsgInput) {
      chatMsgInput.addEventListener('focus', () => {
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
      });
    }
  }

  setupMobileKeyboardAvoidance();

  // Initial Boot
  updateAuthView();
});
