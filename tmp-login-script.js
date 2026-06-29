
  // ── screen router ──
  function goTo(id) {
    document.querySelectorAll('.auth-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ── show/hide password ──
  function togglePass(inputId, iconId) {
    const inp = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (inp.type === 'password') {
      inp.type = 'text';
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    } else {
      inp.type = 'password';
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
  }

  // ── login ──
  async function handleLogin() {
    const u = document.getElementById('login-user');
    const p = document.getElementById('login-pass');
    const ue = document.getElementById('user-err');
    const pe = document.getElementById('pass-err');
    let valid = true;
    u.classList.remove('invalid'); ue.classList.remove('show');
    p.classList.remove('invalid'); pe.classList.remove('show');
    if (!u.value.trim()) { u.classList.add('invalid'); ue.classList.add('show'); valid = false; }
    if (!p.value.trim()) { p.classList.add('invalid'); pe.classList.add('show'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('login-btn');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Logging in...`;
    btn.disabled = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: u.value.trim(), password: p.value })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Login failed.');

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      showToast('Logged in successfully', 'success');
      setTimeout(() => { window.location.href = '../index.html'; }, 1200);
    } catch (error) {
      showToast(error.message, 'error');
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Log in`;
      btn.disabled = false;
    }
  }

  // ── forgot: send code ──
  async function handleSendCode() {
    const emailEl = document.getElementById('reset-email');
    const errEl = document.getElementById('reset-email-err');
    emailEl.classList.remove('invalid'); errEl.classList.remove('show');
    const val = emailEl.value.trim().toLowerCase();
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      emailEl.classList.add('invalid'); errEl.classList.add('show'); return;
    }

    const btn = document.getElementById('send-code-btn');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Sending...`;
    btn.disabled = true;

    // Try backend first; fall back to local implementation
    try {
      const resp = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: val }) });
      if (resp.ok) {
        btn.disabled = false; btn.innerHTML = `Send reset code`;
        document.getElementById('code-email-display').textContent = val;
        for (let i = 0; i < 6; i++) { const c = document.getElementById('c'+i); c.value=''; c.classList.remove('filled'); }
        document.getElementById('code-err').classList.remove('show');
        startResendTimer();
        goTo('screen-code');
        setTimeout(() => document.getElementById('c0').focus(), 150);
        return;
      }
    } catch (e) {
      // ignore and fallback to local
    }

    const users = getLocalUsers();
    const user = users.find(x => x.email === val);
    if (!user) {
      emailEl.classList.add('invalid'); errEl.classList.add('show'); btn.disabled = false; btn.innerHTML = `Send reset code`; return;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codes = JSON.parse(localStorage.getItem('pw_reset_codes') || '[]');
    codes.push({ email: val, code, expires: Date.now() + 10 * 60 * 1000 });
    localStorage.setItem('pw_reset_codes', JSON.stringify(codes));

    btn.disabled = false; btn.innerHTML = `Send reset code`;
    document.getElementById('code-email-display').textContent = val;
    for (let i = 0; i < 6; i++) { const c = document.getElementById('c'+i); c.value=''; c.classList.remove('filled'); }
    document.getElementById('code-err').classList.remove('show');
    startResendTimer();
    goTo('screen-code');
    setTimeout(() => document.getElementById('c0').focus(), 150);
    showToast(`Reset code (dev-only): ${code}`, 'info');
  }

  // ── code inputs ──
  function codeInput(el, idx) {
    el.value = el.value.replace(/\D/g,'').slice(0,1);
    el.classList.toggle('filled', el.value.length > 0);
    if (el.value && idx < 5) document.getElementById('c'+(idx+1)).focus();
    // auto-verify when all filled
    const code = Array.from({length:6}, (_,i) => document.getElementById('c'+i).value).join('');
    if (code.length === 6) setTimeout(handleVerifyCode, 120);
  }

  function codeBack(e, idx) {
    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
      const prev = document.getElementById('c'+(idx-1));
      prev.value = ''; prev.classList.remove('filled'); prev.focus();
    }
  }

  async function handleVerifyCode() {
    const code = Array.from({length:6}, (_,i) => document.getElementById('c'+i).value).join('');
    const errEl = document.getElementById('code-err');
    errEl.classList.remove('show');
    if (code.length < 6) { errEl.classList.add('show'); return; }
    const btn = document.getElementById('verify-btn');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Verifying...`;
    btn.disabled = true;

    // try backend verify first
    try {
      const resp = await fetch('/api/auth/verify-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      if (resp.ok) {
        btn.disabled = false; btn.innerHTML = `Verify code`;
        document.getElementById('new-pass').value = '';
        document.getElementById('confirm-pass').value = '';
        document.getElementById('strength-label').textContent = '';
        ['s0','s1','s2','s3'].forEach(id => { const el = document.getElementById(id); if (el) el.style.background = ''; });
        goTo('screen-newpass');
        setTimeout(() => document.getElementById('new-pass').focus(), 150);
        return;
      }
    } catch (e) {
      // fallback to local
    }

    const codes = JSON.parse(localStorage.getItem('pw_reset_codes') || '[]');
    const found = codes.find(c => c.code === code && c.expires > Date.now());
    if (!found) {
      btn.innerHTML = `Verify code`;
      btn.disabled = false;
      errEl.classList.add('show');
      return;
    }
    // store the email we're resetting in sessionStorage
    sessionStorage.setItem('pw_reset_email', found.email);
    // remove used codes for this email
    const remaining = codes.filter(c => c.email !== found.email);
    localStorage.setItem('pw_reset_codes', JSON.stringify(remaining));

    btn.innerHTML = `Verify code`;
    btn.disabled = false;
    document.getElementById('new-pass').value = '';
    document.getElementById('confirm-pass').value = '';
    document.getElementById('strength-label').textContent = '';
    ['s0','s1','s2','s3'].forEach(id => { const el = document.getElementById(id); if (el) el.style.background = ''; });
    goTo('screen-newpass');
    setTimeout(() => document.getElementById('new-pass').focus(), 150);
  }

  // ── resend timer ──
  let resendTimer = null;
  function startResendTimer() {
    const btn = document.getElementById('resend-btn');
    let secs = 60;
    btn.disabled = true;
    btn.textContent = `Resend in ${secs}s`;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      secs--;
      if (secs <= 0) { clearInterval(resendTimer); btn.disabled = false; btn.textContent = 'Resend code'; }
      else { btn.textContent = `Resend in ${secs}s`; }
    }, 1000);
  }

  async function hashPassword(password) {
    if (window.crypto && crypto.subtle) {
      const enc = new TextEncoder();
      const data = enc.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0;
    for (let i = 0; i < password.length; i++) h = Math.imul(31, h) + password.charCodeAt(i) | 0;
    return (h >>> 0).toString(16);
  }

  function getLocalUsers() { try { return JSON.parse(localStorage.getItem('local_users') || '[]'); } catch { return []; } }
  function findLocalUser(identifier) {
    const id = (identifier || '').trim();
    if (!id) return null;
    const users = getLocalUsers();
    return users.find(u => u.username.toLowerCase() === id.toLowerCase() || u.email === id.toLowerCase());
  }
  function saveLocalUsers(users) { try { localStorage.setItem('local_users', JSON.stringify(users)); } catch (e) { /* ignore */ } }

  async function handleLogin() {
    const u = document.getElementById('login-user');
    const p = document.getElementById('login-pass');
    const ue = document.getElementById('user-err');
    const pe = document.getElementById('pass-err');
    let valid = true;
    u.classList.remove('invalid'); ue.classList.remove('show');
    p.classList.remove('invalid'); pe.classList.remove('show');
    if (!u.value.trim()) { u.classList.add('invalid'); ue.classList.add('show'); valid = false; }
    if (!p.value.trim()) { p.classList.add('invalid'); pe.classList.add('show'); valid = false; }
    if (!valid) return;
    const btn = document.getElementById('login-btn');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Logging in...`;
    btn.disabled = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: u.value.trim(), password: p.value })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authUser', JSON.stringify(data.user));
        showToast('Logged in successfully', 'success');
        setTimeout(() => { window.location.href = '../index.html'; }, 1200);
        return;
      }
      throw new Error(data.error || 'Login failed.');
    } catch (err) {
      // fallback to local users
      try {
        const identifier = u.value.trim();
        const user = findLocalUser(identifier);
        if (!user) throw new Error('User not found (local).');
        const hashed = await hashPassword(p.value);
        if (hashed !== user.password_hash) throw new Error('Invalid username/email or password.');
        const token = (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('authToken', token);
        localStorage.setItem('authUser', JSON.stringify({ id: user.id, username: user.username, email: user.email }));
        try { if (typeof renderAuthState === 'function') renderAuthState(); } catch(e) {}
        showToast('Logged in (local)', 'success');
        setTimeout(() => { window.location.href = '../index.html'; }, 900);
        return;
      } catch (localErr) {
        showToast(localErr.message || 'Unable to sign in', 'error');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Log in`;
        btn.disabled = false;
      }
    }
  }

  function handleResend() {
    const email = document.getElementById('code-email-display').textContent.trim().toLowerCase();
    if (!email) { showToast('No email available to resend code', 'error'); return; }
    const users = getLocalUsers();
    if (!users.find(u => u.email === email)) { showToast('No local user for that email', 'error'); return; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codes = JSON.parse(localStorage.getItem('pw_reset_codes') || '[]');
    codes.push({ email, code, expires: Date.now() + 10 * 60 * 1000 });
    localStorage.setItem('pw_reset_codes', JSON.stringify(codes));
    for (let i = 0; i < 6; i++) { const c = document.getElementById('c'+i); c.value=''; c.classList.remove('filled'); }
    document.getElementById('c0').focus();
    startResendTimer();
    showToast(`Reset code (dev-only): ${code}`, 'info');
  }

  async function handleResetPassword() {
    const np = document.getElementById('new-pass');
    const cp = document.getElementById('confirm-pass');
    const npe = document.getElementById('new-pass-err');
    const cpe = document.getElementById('confirm-pass-err');
    np.classList.remove('invalid'); npe.classList.remove('show');
    cp.classList.remove('invalid'); cpe.classList.remove('show');
    let valid = true;
    if (np.value.length < 8) { np.classList.add('invalid'); npe.classList.add('show'); valid = false; }
    if (np.value !== cp.value) { cp.classList.add('invalid'); cpe.classList.add('show'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('reset-btn');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Resetting...`;
    btn.disabled = true;

    (async () => {
      try {
        const newPass = np.value;
        // try backend
        try {
          const resp = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: newPass, email: sessionStorage.getItem('pw_reset_email') }) });
          if (resp.ok) {
            btn.innerHTML = `Reset password`;
            btn.disabled = false;
            goTo('screen-done');
            return;
          }
        } catch (e) {}

        // local fallback
        const email = sessionStorage.getItem('pw_reset_email');
        if (!email) throw new Error('No reset session found.');
        const users = getLocalUsers();
        const idx = users.findIndex(u => u.email === email);
        if (idx === -1) throw new Error('Local user not found.');
        const hashed = await hashPassword(newPass);
        users[idx].password_hash = hashed;
        saveLocalUsers(users);
        sessionStorage.removeItem('pw_reset_email');
        btn.innerHTML = `Reset password`;
        btn.disabled = false;
        goTo('screen-done');
      } catch (err) {
        btn.innerHTML = `Reset password`;
        btn.disabled = false;
        showToast(err.message || 'Unable to reset password', 'error');
      }
    })();
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const active = document.querySelector('.auth-screen.active').id;
      if (active === 'screen-login') handleLogin();
      else if (active === 'screen-forgot') handleSendCode();
      else if (active === 'screen-newpass') handleResetPassword();
    }
  });

  // expose handlers globally in case inline onclick references need them
  try { window.handleLogin = handleLogin; window.handleSendCode = handleSendCode; window.handleVerifyCode = handleVerifyCode; window.handleResetPassword = handleResetPassword; window.handleResend = handleResend; } catch(e) {}
