// Auth Modal Controller for Nkem Global (Sign Up & Login)
// Strict Zero Native <select>, Zero Emojis, Zero Shadows/Glows/Gradients

(function() {
  let activeOverlay = null;
  let statePicker = null;
  let lgaPicker = null;
  let selectedState = '';
  let selectedLga = '';

  function closeAuthModal() {
    if (activeOverlay && activeOverlay.parentNode) {
      activeOverlay.parentNode.removeChild(activeOverlay);
      activeOverlay = null;
    }
  }

  function attachPasswordVisibilityToggles(container) {
    if (!container) return;
    container.querySelectorAll('.btn-toggle-password').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        const input = container.querySelector('#' + targetId) || document.getElementById(targetId);
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.innerHTML = isPassword ? window.renderIcon('eyeOff') : window.renderIcon('eye');
        btn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
        btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      });
    });
  }


  function renderSignUpModal(onSuccess) {
    closeAuthModal();

    const overlay = document.createElement('div');
    overlay.className = 'c-modal-overlay active';
    overlay.id = 'authSignUpModal';

    overlay.innerHTML = `
      <div class="auth-modal-box">
        <div class="c-modal-header">
          <div>
            <h3 class="c-modal-title">Create Account</h3>
            <span style="font-size: var(--font-xs); color: var(--text-muted);">Join Nkem Global for Direct Orders & Live Chat</span>
          </div>
          <button class="c-modal-close-btn" type="button" id="authCloseBtn" aria-label="Close">
            ${window.renderIcon('close')}
          </button>
        </div>

        <form class="auth-modal-form" id="signUpForm" novalidate>
          <div class="auth-form-row two-col">
            <div class="form-group">
              <label class="form-label" for="regFirstName">First Name *</label>
              <input type="text" class="input-field" id="regFirstName" required placeholder="e.g. Chukwuma" />
            </div>
            <div class="form-group">
              <label class="form-label" for="regLastName">Last Name *</label>
              <input type="text" class="input-field" id="regLastName" required placeholder="e.g. Okonkwo" />
            </div>
          </div>

          <div class="auth-form-row two-col">
            <div class="form-group">
              <label class="form-label" for="regWhatsapp">WhatsApp Number *</label>
              <input type="tel" class="input-field" id="regWhatsapp" required placeholder="e.g. 08155608447" />
            </div>
            <div class="form-group">
              <label class="form-label" for="regEmail">Email Address (Optional)</label>
              <input type="email" class="input-field" id="regEmail" placeholder="e.g. okonkwo@gmail.com" />
            </div>
          </div>

          <div class="auth-form-row two-col">
            <div class="form-group">
              <label class="form-label">Delivery State *</label>
              <div class="c-picker-container" id="regStatePickerMount"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Local Government Area (LGA) *</label>
              <div class="c-picker-container" id="regLgaPickerMount"></div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="regAddress">Full Delivery Address *</label>
            <input type="text" class="input-field" id="regAddress" required placeholder="Street address, building, landmark, area" />
          </div>

          <div class="auth-form-row two-col">
            <div class="form-group">
              <label class="form-label" for="regPassword">Password (6+ characters) *</label>
              <div class="password-input-wrap">
                <input type="password" class="input-field" id="regPassword" required placeholder="Enter secure password" />
                <button type="button" class="btn-toggle-password" data-target="regPassword" title="Show or hide password" aria-label="Toggle password visibility">
                  ${window.renderIcon('eye')}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="regConfirmPassword">Retype Password *</label>
              <div class="password-input-wrap">
                <input type="password" class="input-field" id="regConfirmPassword" required placeholder="Retype password" />
                <button type="button" class="btn-toggle-password" data-target="regConfirmPassword" title="Show or hide password" aria-label="Toggle password visibility">
                  ${window.renderIcon('eye')}
                </button>
              </div>
            </div>
          </div>

          <div class="auth-action-row">
            <button class="btn btn-primary" style="width: 100%; justify-content: center;" type="submit" id="regSubmitBtn">
              <span>Create Account</span>
            </button>
          </div>

          <div class="auth-switch-row">
            <span>Already have an account?</span>
            <button type="button" class="auth-switch-btn" id="switchToSignInBtn">Sign In</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // Close button
    overlay.querySelector('#authCloseBtn').addEventListener('click', () => {
      closeAuthModal();
      if (typeof onSuccess === 'function') onSuccess();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAuthModal();
        if (typeof onSuccess === 'function') onSuccess();
      }
    });

    // Switch to Sign In
    attachPasswordVisibilityToggles(overlay);

    overlay.querySelector('#switchToSignInBtn').addEventListener('click', () => {
      renderSignInModal(onSuccess);
    });

    // Setup Custom Modular State & LGA Pickers (Zero Native <select>)
    const stateMount = overlay.querySelector('#regStatePickerMount');
    const lgaMount = overlay.querySelector('#regLgaPickerMount');
    const statesData = window.NIGERIA_STATES_DATA || {};
    const stateList = Object.keys(statesData);

    selectedState = '';
    selectedLga = '';

    function updateLgaOptions(stateName) {
      selectedLga = '';
      lgaMount.innerHTML = '';

      if (!stateName) {
        lgaPicker = window.CustomPicker.create({
          container: lgaMount,
          id: 'regLgaPicker',
          title: 'Select LGA',
          options: [],
          value: '',
          placeholder: 'Select State First',
          onChange: () => {}
        });
        if (lgaPicker && lgaPicker.setDisabled) lgaPicker.setDisabled(true);
        return;
      }

      const lgas = statesData[stateName] || [];
      const lgaOptions = lgas.map(l => ({ value: l, label: l }));
      
      lgaPicker = window.CustomPicker.create({
        container: lgaMount,
        id: 'regLgaPicker',
        title: `Select LGA (${stateName})`,
        options: lgaOptions,
        value: '',
        placeholder: 'Select LGA',
        onChange: (val) => {
          selectedLga = val;
        }
      });
    }

    const stateOptions = stateList.map(s => ({ value: s, label: s }));
    statePicker = window.CustomPicker.create({
      container: stateMount,
      id: 'regStatePicker',
      title: 'Select State',
      options: stateOptions,
      value: '',
      placeholder: 'Select State',
      onChange: (val) => {
        selectedState = val;
        updateLgaOptions(val);
      }
    });

    updateLgaOptions('');

    // Auto-capitalize name fields in real-time
    const regFnInput = overlay.querySelector('#regFirstName');
    const regLnInput = overlay.querySelector('#regLastName');
    if (window.attachNameAutoCapitalize) {
      window.attachNameAutoCapitalize(regFnInput);
      window.attachNameAutoCapitalize(regLnInput);
    }

    // Form submit
    const form = overlay.querySelector('#signUpForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const firstName = window.capitalizeName ? window.capitalizeName(regFnInput.value) : regFnInput.value.trim();
      const lastName = window.capitalizeName ? window.capitalizeName(regLnInput.value) : regLnInput.value.trim();
      const whatsapp = overlay.querySelector('#regWhatsapp').value.trim();
      const email = overlay.querySelector('#regEmail').value.trim();
      const address = overlay.querySelector('#regAddress').value.trim();
      const password = overlay.querySelector('#regPassword').value;
      const confirmPassword = overlay.querySelector('#regConfirmPassword').value;

      if (!firstName || !lastName) {
        window.CustomModal.toast({ message: 'Please enter your first and last name.', type: 'warning' });
        return;
      }
      if (!whatsapp || whatsapp.length < 10) {
        window.CustomModal.toast({ message: 'Please enter a valid WhatsApp phone number.', type: 'warning' });
        return;
      }
      if (!selectedState) {
        window.CustomModal.toast({ message: 'Please select your delivery State.', type: 'warning' });
        return;
      }
      if (!selectedLga) {
        window.CustomModal.toast({ message: 'Please select your Local Government Area (LGA).', type: 'warning' });
        return;
      }
      if (!address || address.length < 5) {
        window.CustomModal.toast({ message: 'Please type your full delivery address.', type: 'warning' });
        return;
      }
      if (!password || password.length < 6) {
        window.CustomModal.toast({ message: 'Password must be at least 6 characters.', type: 'warning' });
        return;
      }
      if (password !== confirmPassword) {
        window.CustomModal.toast({ message: 'Passwords do not match. Please retype carefully.', type: 'danger' });
        return;
      }

      const submitBtn = overlay.querySelector('#regSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Creating Account...</span>`;

      try {
        const user = await window.SupabaseService.signUpUser({
          first_name: firstName,
          last_name: lastName,
          whatsapp_number: whatsapp,
          email: email,
          state: selectedState,
          lga: selectedLga,
          address: address,
          password: password
        });

        window.CustomModal.toast({ message: `Welcome ${user.first_name}! Your account has been created.`, type: 'success' });
        closeAuthModal();
        if (typeof onSuccess === 'function') onSuccess(user);
      } catch (err) {
        window.CustomModal.toast({ message: err.message || 'Failed to create account.', type: 'danger' });
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Create Account</span>`;
      }
    });
  }

  function renderSignInModal(onSuccess) {
    closeAuthModal();

    const overlay = document.createElement('div');
    overlay.className = 'c-modal-overlay active';
    overlay.id = 'authSignInModal';

    overlay.innerHTML = `
      <div class="auth-modal-box">
        <div class="c-modal-header">
          <div>
            <h3 class="c-modal-title">Sign In</h3>
            <span style="font-size: var(--font-xs); color: var(--text-muted);">Access Nkem Global Direct Support & Orders</span>
          </div>
          <button class="c-modal-close-btn" type="button" id="authCloseBtn" aria-label="Close">
            ${window.renderIcon('close')}
          </button>
        </div>

        <form class="auth-modal-form" id="signInForm" novalidate>
          <div class="form-group">
            <label class="form-label" for="loginIdentifier">WhatsApp Number or Email *</label>
            <input type="text" class="input-field" id="loginIdentifier" required placeholder="e.g. 08155608447 or your@email.com" />
          </div>

          <div class="form-group">
            <label class="form-label" for="loginPassword">Password *</label>
            <div class="password-input-wrap">
              <input type="password" class="input-field" id="loginPassword" required placeholder="Enter your password" />
              <button type="button" class="btn-toggle-password" data-target="loginPassword" title="Show or hide password" aria-label="Toggle password visibility">
                ${window.renderIcon('eye')}
              </button>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: -6px;">
            <button type="button" class="auth-forgot-link" id="forgotPasswordBtn" style="background: none; border: none; color: var(--accent-gold); font-size: var(--font-xs); cursor: pointer; text-decoration: underline;">
              Forgot Password?
            </button>
          </div>

          <div class="auth-action-row">
            <button class="btn btn-primary" style="width: 100%; justify-content: center;" type="submit" id="loginSubmitBtn">
              <span>Sign In</span>
            </button>
          </div>

          <div class="auth-switch-row">
            <span>Don't have an account?</span>
            <button type="button" class="auth-switch-btn" id="switchToSignUpBtn">Create Account</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // Close button
    overlay.querySelector('#authCloseBtn').addEventListener('click', () => {
      closeAuthModal();
      if (typeof onSuccess === 'function') onSuccess();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAuthModal();
        if (typeof onSuccess === 'function') onSuccess();
      }
    });

    // Switch to Sign Up
    attachPasswordVisibilityToggles(overlay);

    overlay.querySelector('#switchToSignUpBtn').addEventListener('click', () => {
      renderSignUpModal(onSuccess);
    });

    // Forgot Password
    const forgotBtn = overlay.querySelector('#forgotPasswordBtn');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => {
        renderForgotPasswordModal(onSuccess);
      });
    }

    // Form submit
    const form = overlay.querySelector('#signInForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const identifier = overlay.querySelector('#loginIdentifier').value.trim();
      const password = overlay.querySelector('#loginPassword').value;

      if (!identifier) {
        window.CustomModal.toast({ message: 'Please enter your WhatsApp number or email.', type: 'warning' });
        return;
      }
      if (!password) {
        window.CustomModal.toast({ message: 'Please enter your password.', type: 'warning' });
        return;
      }

      const submitBtn = overlay.querySelector('#loginSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Signing In...</span>`;

      try {
        const user = await window.SupabaseService.signInUser(identifier, password);
        window.CustomModal.toast({ message: `Welcome back, ${user.first_name}!`, type: 'success' });
        closeAuthModal();
        if (typeof onSuccess === 'function') onSuccess(user);
      } catch (err) {
        window.CustomModal.toast({ message: err.message || 'Login failed.', type: 'danger' });
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In</span>`;
      }
    });
  }

  function renderForgotPasswordModal(onSuccess) {
    closeAuthModal();

    const overlay = document.createElement('div');
    overlay.className = 'c-modal-overlay active';
    overlay.id = 'authForgotModal';

    overlay.innerHTML = `
      <div class="auth-modal-box">
        <div class="c-modal-header">
          <div>
            <h3 class="c-modal-title">Password Recovery</h3>
            <span style="font-size: var(--font-xs); color: var(--text-muted);">Direct Verification by Nkem Global Admin</span>
          </div>
          <button class="c-modal-close-btn" type="button" id="authCloseBtn" aria-label="Close">
            ${window.renderIcon('close')}
          </button>
        </div>

        <div class="auth-modal-form">
          <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; font-size: var(--font-xs); color: var(--text-main); line-height: 1.5;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: var(--accent-gold);">Forgotten your account password?</p>
            <p style="margin: 0; color: var(--text-muted);">
              For instant security verification, message our admin directly on WhatsApp. The admin will verify your identity and restore or provide your registered login password and credentials.
            </p>
          </div>

          <div class="form-group" style="margin-top: 6px;">
            <label class="form-label" for="forgotIdentifier">Your Registered WhatsApp Number or Email (Optional)</label>
            <input type="text" class="input-field" id="forgotIdentifier" placeholder="e.g. 08155608447 or your@email.com" />
          </div>

          <div class="auth-action-row" style="margin-top: 10px;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center; gap: 8px;" type="button" id="waContactAdminBtn">
              <span style="display: inline-flex; align-items: center; justify-content: center; color: #25D366; font-size: 18px; line-height: 1;">
                ${window.renderIcon('whatsapp')}
              </span>
              <span>Message Admin on WhatsApp</span>
            </button>
          </div>

          <div style="text-align: center; margin-top: 10px; font-size: var(--font-xs); color: var(--text-muted); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #25D366; display: inline-flex; align-items: center; font-size: 14px; line-height: 1;">${window.renderIcon('whatsapp')}</span>
              <span>WhatsApp: <strong style="color: var(--accent-gold);">+234 815 560 8447</strong></span>
              <button type="button" id="copyAdminWaBtn" style="background: none; border: 1px solid var(--border-color); color: var(--text-main); font-size: 11px; padding: 2px 6px; border-radius: 3px; margin-left: 4px; cursor: pointer;">Copy</button>
            </div>
            <div style="font-size: 11px; color: var(--text-subtle);">
              Major Line: <a href="tel:+2347042087633" style="color: var(--text-main); text-decoration: underline;">+234 704 208 7633</a>
            </div>
          </div>

          <div class="auth-switch-row" style="margin-top: 16px;">
            <span>Remembered your password?</span>
            <button type="button" class="auth-switch-btn" id="backToSignInBtn">Sign In</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    activeOverlay = overlay;

    overlay.querySelector('#authCloseBtn').addEventListener('click', closeAuthModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAuthModal();
    });

    overlay.querySelector('#backToSignInBtn').addEventListener('click', () => {
      renderSignInModal(onSuccess);
    });

    overlay.querySelector('#copyAdminWaBtn').addEventListener('click', () => {
      navigator.clipboard.writeText('08155608447');
      window.CustomModal.toast({ message: 'WhatsApp number (+234 815 560 8447) copied to clipboard.', type: 'info' });
    });

    overlay.querySelector('#waContactAdminBtn').addEventListener('click', () => {
      const idVal = overlay.querySelector('#forgotIdentifier').value.trim();
      const message = `Hello Admin, I have forgotten my Nkem Global account password. Please could you verify my identity and recover my login credentials for me?${idVal ? ' My registered details: ' + idVal : ''}`;
      const url = `https://wa.me/2348155608447?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    });
  }

  function renderProfileModal(initialTab = 'profile', onSuccess) {
    if (typeof initialTab === 'function') {
      onSuccess = initialTab;
      initialTab = 'profile';
    }
    closeAuthModal();
    const user = window.SupabaseService.getCurrentUser();
    if (!user) {
      renderSignInModal(onSuccess);
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'c-modal-overlay active';
    overlay.id = 'authProfileModal';

    overlay.innerHTML = `
      <div class="auth-modal-box" style="max-width: 640px;">
        <div class="c-modal-header">
          <div>
            <h3 class="c-modal-title">My Account & Profile</h3>
            <span style="font-size: var(--font-xs); color: var(--text-muted);">${window.CustomModal.escape(user.first_name)} ${window.CustomModal.escape(user.last_name)} &bull; ${window.CustomModal.escape(user.whatsapp_number)}</span>
          </div>
          <button class="c-modal-close-btn" type="button" id="authCloseBtn" aria-label="Close">
            ${window.renderIcon('close')}
          </button>
        </div>

        <div class="profile-tabs-header" style="display: flex; border-bottom: 1px solid var(--border-color); background: var(--bg-surface-elevated);">
          <button type="button" class="profile-tab-btn" id="tabBtnProfile" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid ${initialTab === 'profile' ? 'var(--accent-gold)' : 'transparent'}; color: ${initialTab === 'profile' ? 'var(--accent-gold)' : 'var(--text-muted)'}; font-weight: 600; font-size: var(--font-xs); cursor: pointer;">
            Edit Profile & Delivery Address
          </button>
          <button type="button" class="profile-tab-btn" id="tabBtnSecurity" style="flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid ${initialTab === 'security' ? 'var(--accent-gold)' : 'transparent'}; color: ${initialTab === 'security' ? 'var(--accent-gold)' : 'var(--text-muted)'}; font-weight: 600; font-size: var(--font-xs); cursor: pointer;">
            Change Password
          </button>
        </div>

        <!-- TAB 1: EDIT PROFILE -->
        <form class="auth-modal-form" id="profileEditForm" style="display: ${initialTab === 'profile' ? 'flex' : 'none'};" novalidate>
          <div class="auth-form-row two-col">
            <div class="form-group">
              <label class="form-label" for="profFirstName">First Name *</label>
              <input type="text" class="input-field" id="profFirstName" required value="${window.CustomModal.escape(user.first_name || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="profLastName">Last Name *</label>
              <input type="text" class="input-field" id="profLastName" required value="${window.CustomModal.escape(user.last_name || '')}" />
            </div>
          </div>

          <div class="auth-form-row two-col">
            <div class="form-group">
              <label class="form-label" for="profWhatsapp">WhatsApp Number *</label>
              <input type="tel" class="input-field" id="profWhatsapp" required value="${window.CustomModal.escape(user.whatsapp_number || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="profEmail">Email Address (Optional)</label>
              <input type="email" class="input-field" id="profEmail" value="${window.CustomModal.escape(user.email || '')}" />
            </div>
          </div>

          <div class="auth-form-row two-col">
            <div class="form-group">
              <label class="form-label">Delivery State *</label>
              <div class="c-picker-container" id="profStatePickerMount"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Local Government Area (LGA) *</label>
              <div class="c-picker-container" id="profLgaPickerMount"></div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="profAddress">Full Delivery Address *</label>
            <input type="text" class="input-field" id="profAddress" required value="${window.CustomModal.escape(user.address || '')}" />
          </div>

          <div class="auth-action-row" style="margin-top: 6px;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center;" type="submit" id="profSaveBtn">
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>

        <!-- TAB 2: CHANGE PASSWORD (STRICTLY SEPARATE) -->
        <form class="auth-modal-form" id="passwordChangeForm" style="display: ${initialTab === 'security' ? 'flex' : 'none'};" novalidate>
          <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 6px;">
            <p style="font-size: var(--font-xs); color: var(--text-muted); margin: 0;">
              Enter your current password, followed by your new password (minimum 6 characters).
            </p>
          </div>

          <div class="form-group">
            <label class="form-label" for="oldPassword">Current (Old) Password *</label>
            <div class="password-input-wrap">
              <input type="password" class="input-field" id="oldPassword" required placeholder="Type current password" />
              <button type="button" class="btn-toggle-password" data-target="oldPassword" title="Show or hide password" aria-label="Toggle password visibility">
                ${window.renderIcon('eye')}
              </button>
            </div>
          </div>

          <div class="auth-form-row two-col">
            <div class="form-group">
              <label class="form-label" for="newPassword">New Password *</label>
              <div class="password-input-wrap">
                <input type="password" class="input-field" id="newPassword" required placeholder="Min. 6 characters" />
                <button type="button" class="btn-toggle-password" data-target="newPassword" title="Show or hide password" aria-label="Toggle password visibility">
                  ${window.renderIcon('eye')}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="confirmNewPassword">Retype New Password *</label>
              <div class="password-input-wrap">
                <input type="password" class="input-field" id="confirmNewPassword" required placeholder="Retype new password" />
                <button type="button" class="btn-toggle-password" data-target="confirmNewPassword" title="Show or hide password" aria-label="Toggle password visibility">
                  ${window.renderIcon('eye')}
                </button>
              </div>
            </div>
          </div>

          <div class="auth-action-row" style="margin-top: 6px;">
            <button class="btn btn-primary" style="width: 100%; justify-content: center;" type="submit" id="pwdUpdateBtn">
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);
    activeOverlay = overlay;

    // Close button
    overlay.querySelector('#authCloseBtn').addEventListener('click', () => {
      closeAuthModal();
      if (typeof onSuccess === 'function') onSuccess();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAuthModal();
        if (typeof onSuccess === 'function') onSuccess();
      }
    });

    // Tab switching
    attachPasswordVisibilityToggles(overlay);

    const tabBtnProfile = overlay.querySelector('#tabBtnProfile');
    const tabBtnSecurity = overlay.querySelector('#tabBtnSecurity');
    const profileEditForm = overlay.querySelector('#profileEditForm');
    const passwordChangeForm = overlay.querySelector('#passwordChangeForm');

    tabBtnProfile.addEventListener('click', () => {
      tabBtnProfile.style.borderBottomColor = 'var(--accent-gold)';
      tabBtnProfile.style.color = 'var(--accent-gold)';
      tabBtnSecurity.style.borderBottomColor = 'transparent';
      tabBtnSecurity.style.color = 'var(--text-muted)';
      profileEditForm.style.display = 'flex';
      passwordChangeForm.style.display = 'none';
    });

    tabBtnSecurity.addEventListener('click', () => {
      tabBtnSecurity.style.borderBottomColor = 'var(--accent-gold)';
      tabBtnSecurity.style.color = 'var(--accent-gold)';
      tabBtnProfile.style.borderBottomColor = 'transparent';
      tabBtnProfile.style.color = 'var(--text-muted)';
      passwordChangeForm.style.display = 'flex';
      profileEditForm.style.display = 'none';
    });

    // Setup State & LGA Pickers for Profile
    const profStateMount = overlay.querySelector('#profStatePickerMount');
    const profLgaMount = overlay.querySelector('#profLgaPickerMount');
    const statesData = window.NIGERIA_STATES_DATA || {};
    const stateList = Object.keys(statesData);

    let curState = user.state || '';
    let curLga = user.lga || '';

    function updateProfLgas(st, resetLga = false) {
      if (resetLga) curLga = '';
      profLgaMount.innerHTML = '';

      if (!st) {
        const picker = window.CustomPicker.create({
          container: profLgaMount,
          id: 'profLgaPicker',
          title: 'Select LGA',
          options: [],
          value: '',
          placeholder: 'Select State First',
          onChange: () => {}
        });
        if (picker && picker.setDisabled) picker.setDisabled(true);
        return;
      }

      const lgas = statesData[st] || [];
      if (!lgas.includes(curLga)) curLga = '';

      window.CustomPicker.create({
        container: profLgaMount,
        id: 'profLgaPicker',
        title: `Select LGA (${st})`,
        options: lgas.map(l => ({ value: l, label: l })),
        value: curLga,
        placeholder: 'Select LGA',
        onChange: (v) => { curLga = v; }
      });
    }

    window.CustomPicker.create({
      container: profStateMount,
      id: 'profStatePicker',
      title: 'Select State',
      options: stateList.map(s => ({ value: s, label: s })),
      value: curState,
      placeholder: 'Select State',
      onChange: (v) => {
        curState = v;
        updateProfLgas(v, true);
      }
    });

    updateProfLgas(curState, false);

    // Auto-capitalize profile name fields in real-time
    const profFnInput = overlay.querySelector('#profFirstName');
    const profLnInput = overlay.querySelector('#profLastName');
    if (window.attachNameAutoCapitalize) {
      window.attachNameAutoCapitalize(profFnInput);
      window.attachNameAutoCapitalize(profLnInput);
    }

    // Profile Submit
    profileEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fn = window.capitalizeName ? window.capitalizeName(profFnInput.value) : profFnInput.value.trim();
      const ln = window.capitalizeName ? window.capitalizeName(profLnInput.value) : profLnInput.value.trim();
      const wa = overlay.querySelector('#profWhatsapp').value.trim();
      const em = overlay.querySelector('#profEmail').value.trim();
      const addr = overlay.querySelector('#profAddress').value.trim();

      if (!fn || !ln) {
        window.CustomModal.toast({ message: 'First name and last name are required.', type: 'warning' });
        return;
      }
      if (!wa || wa.length < 10) {
        window.CustomModal.toast({ message: 'Please enter a valid WhatsApp number.', type: 'warning' });
        return;
      }
      if (!addr || addr.length < 5) {
        window.CustomModal.toast({ message: 'Please enter your delivery address.', type: 'warning' });
        return;
      }

      const saveBtn = overlay.querySelector('#profSaveBtn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span>Saving Changes...</span>`;

      try {
        await window.SupabaseService.updateUserProfile(user.id, {
          first_name: fn,
          last_name: ln,
          whatsapp_number: wa,
          email: em,
          state: curState,
          lga: curLga,
          address: addr
        });

        window.CustomModal.toast({ message: 'Profile updated successfully!', type: 'success' });
        closeAuthModal();
        if (typeof onSuccess === 'function') {
          try { onSuccess(); } catch (cbErr) { console.warn(cbErr); }
        }
        window.dispatchEvent(new CustomEvent('user-profile-updated'));
      } catch (err) {
        window.CustomModal.toast({ message: err.message || 'Failed to update profile.', type: 'danger' });
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<span>Save Profile Changes</span>`;
      }
    });

    // Password Submit
    passwordChangeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPwd = (overlay.querySelector('#oldPassword')?.value || '').trim();
      const newPwd = (overlay.querySelector('#newPassword')?.value || '').trim();
      const confirmPwd = (overlay.querySelector('#confirmNewPassword')?.value || '').trim();

      if (!oldPwd) {
        window.CustomModal.toast({ message: 'Please enter your current password.', type: 'warning' });
        return;
      }
      if (!newPwd || newPwd.length < 6) {
        window.CustomModal.toast({ message: 'New password must be at least 6 characters.', type: 'warning' });
        return;
      }
      if (newPwd !== confirmPwd) {
        window.CustomModal.toast({ message: 'New passwords do not match. Please retype carefully.', type: 'danger' });
        return;
      }
      if (newPwd === oldPwd) {
        window.CustomModal.toast({ message: 'New password must be different from current password.', type: 'warning' });
        return;
      }

      const updateBtn = overlay.querySelector('#pwdUpdateBtn');
      updateBtn.disabled = true;
      updateBtn.innerHTML = `<span>Updating Password...</span>`;

      try {
        await window.SupabaseService.changeUserPassword(user.id, oldPwd, newPwd);
        window.CustomModal.toast({ message: 'Password updated successfully!', type: 'success' });
        closeAuthModal();
      } catch (err) {
        window.CustomModal.toast({ message: err.message || 'Failed to change password.', type: 'danger' });
        updateBtn.disabled = false;
        updateBtn.innerHTML = `<span>Update Password</span>`;
      }
    });
  }

  window.AuthModal = {
    showSignIn: renderSignInModal,
    openSignIn: renderSignInModal,
    showSignUp: renderSignUpModal,
    openSignUp: renderSignUpModal,
    openRegister: renderSignUpModal,
    showForgotPassword: renderForgotPasswordModal,
    openForgotPassword: renderForgotPasswordModal,
    showProfile: renderProfileModal,
    openProfile: renderProfileModal,
    openProfileEditor: renderProfileModal,
    close: closeAuthModal
  };
})();
