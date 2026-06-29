
    // helper: tab switching
    function showTab(name) {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab===name));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active-panel', p.id === name));
      const title = document.getElementById('panel-title'); if (title) { const label = name.charAt(0).toUpperCase() + name.slice(1); title.textContent = label === 'Export' ? 'Export / Delete' : label; }
    }

    document.getElementById('tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) showTab(t.dataset.tab); });


    // timezone list (subset but extensive)
    const TIMEZONES = [
      'UTC','Etc/UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','America/Phoenix','America/Toronto','America/Vancouver','Europe/London','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Moscow','Asia/Tokyo','Asia/Seoul','Asia/Shanghai','Asia/Hong_Kong','Asia/Singapore','Asia/Kolkata','Asia/Dubai','Australia/Sydney','Australia/Melbourne','Pacific/Auckland'
    ];

    function populateTimezones() {
      const tz = document.getElementById('acct-tz'); if (!tz) return;
      tz.innerHTML = '';
      TIMEZONES.forEach(z=>{ const o = document.createElement('option'); o.value=z; o.textContent=z.replace('_',' '); tz.appendChild(o); });
    }

    // clock
    let _clockInterval = null;
    function updateClockForUser() {
      const auth = getAuthUser(); if (!auth) return;
      const prefs = JSON.parse(localStorage.getItem('user_prefs_'+auth.id)||'{}');
      const tz = prefs.tz || document.getElementById('acct-tz')?.value || 'UTC';
      const el = document.getElementById('sidebar-clock'); if (!el) return;
      try { el.textContent = new Date().toLocaleString([], { hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone: tz }); } catch(e){ el.textContent = new Date().toLocaleTimeString(); }
      if (_clockInterval) clearInterval(_clockInterval); _clockInterval = setInterval(()=>{ try{ el.textContent = new Date().toLocaleString([], { hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone: tz }); }catch(e){ el.textContent = new Date().toLocaleTimeString(); } },1000);
    }

    async function loadAccount() {
      populateTimezones();
      const auth = getAuthUser(); if (!auth) { showToast('Not signed in', 'error'); setTimeout(()=>location.href='../pages/login.html',600); return; }
      const users = getLocalUsers();
      const me = users.find(u => u.id === auth.id || u.email === auth.email) || auth;
      document.getElementById('acct-username').value = me.username || '';
      document.getElementById('acct-displayname').value = me.displayName || '';
      document.getElementById('acct-bio').value = me.bio || '';
      document.getElementById('acct-tz').value = (me.tz || JSON.parse(localStorage.getItem('user_prefs_'+(me.id||'anon'))||'{}').tz) || 'UTC';
      document.getElementById('sidebar-name').textContent = me.displayName || me.username || 'User';
      document.getElementById('sidebar-email').textContent = me.email || '';
      const avatar = document.getElementById('sidebar-avatar');
      const avatarData = localStorage.getItem('user_avatar_'+me.id);
      if (avatar) {
        if (avatarData) { avatar.style.backgroundImage = `url(${avatarData})`; avatar.textContent = ''; avatar.style.backgroundSize='cover'; }
        else { avatar.textContent = (me.username || 'U').charAt(0).toUpperCase(); avatar.style.backgroundImage='none'; }
      }
      // preferences
      const prefs = JSON.parse(localStorage.getItem('user_prefs_'+(me.id||'anon'))||'{}');
      // theme is forced dark
      document.getElementById('pref-notifs').checked = !!prefs.notifs;
      document.getElementById('pref-lang').value = prefs.lang || 'en';
      document.getElementById('pref-date').value = prefs.date || 'iso';
      updateClockForUser();
      applyLanguage(document.getElementById('pref-lang').value);
    }

    document.getElementById('refresh-profile').addEventListener('click', loadAccount);

    document.getElementById('save-profile').addEventListener('click', () => {
      (async ()=>{
        const auth = getAuthUser(); if (!auth) return showToast('Not signed in','error');
        const users = getLocalUsers();
        const idx = users.findIndex(u => u.id === auth.id || u.email === auth.email);
        if (idx === -1) return showToast('Local user not found','error');
        const newUser = { ...users[idx] };
        const nu = document.getElementById('acct-username').value.trim();
        const dn = document.getElementById('acct-displayname').value.trim();
        const bio = document.getElementById('acct-bio').value.trim();
        const tz = document.getElementById('acct-tz').value;
        if (!nu || nu.length < 3) return showToast('Invalid username','error');
        
        if (users.some((u,i) => i!==idx && u.username.toLowerCase()===nu.toLowerCase())) return showToast('Username already taken','error');
        newUser.username = nu; newUser.displayName = dn; newUser.bio = bio; newUser.tz = tz;
        users[idx] = newUser; saveLocalUsers(users);
        localStorage.setItem('authUser', JSON.stringify({ id: newUser.id, username: newUser.username, email: newUser.email }));
        // save tz to prefs
        const prefs = JSON.parse(localStorage.getItem('user_prefs_'+newUser.id)||'{}'); prefs.tz = tz; localStorage.setItem('user_prefs_'+newUser.id, JSON.stringify(prefs));
        renderAuthState();
        updateClockForUser();
        showToast('Profile updated','success');
      })();
    });

    document.getElementById('upload-avatar').addEventListener('click', () => {
      const auth = getAuthUser(); if (!auth) return showToast('Not signed in','error');
      const input = document.createElement('input'); input.type='file'; input.accept='image/*'; input.onchange = e => {
        const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ()=>{ try{ localStorage.setItem('user_avatar_'+auth.id, r.result); loadAccount(); showToast('Avatar uploaded','success'); }catch(err){ showToast('Unable to save avatar','error'); } }; r.readAsDataURL(f);
      }; input.click();
    });

    document.getElementById('change-pass').addEventListener('click', () => {
      // existing reset link flow kept
      (async ()=>{
        const auth = getAuthUser(); if (!auth) return showToast('Not signed in','error');
        const users = getLocalUsers(); const me = users.find(u=>u.id===auth.id||u.email===auth.email) || auth;
        if (!me || !me.email) return showToast('No email on file','error');
        const btn = document.getElementById('change-pass'); btn.disabled = true; btn.textContent = 'Sending...';
        try {
          const resp = await fetch('/api/auth/send-reset-link', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email: me.email }) });
          const data = await resp.json(); if (resp.ok) { showToast('Password reset email sent (check your inbox)', 'success'); console.log('Reset link (dev):', data.link); } else { throw new Error(data.error || 'Unable to send reset email'); }
        } catch (e) { showToast(e.message || 'Unable to send reset email', 'error'); }
        finally { btn.disabled = false; btn.textContent = 'Change password'; }
      })();
    });

    // change email flow
    document.getElementById('send-verify-email').addEventListener('click', async () => {
      const newEmail = document.getElementById('change-email').value.trim().toLowerCase();
      const status = document.getElementById('change-email-status'); if (status) status.textContent = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return showToast('Enter a valid email','error');
      const btn = document.getElementById('send-verify-email'); btn.disabled = true; btn.textContent = 'Sending...';
      try {
        const resp = await fetch('/api/auth/send-verify-email', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email: newEmail }) });
        const data = await resp.json().catch(()=>({}));
        if (resp.ok) {
          if (status) status.textContent = 'Verification sent';
          showToast('Verification sent','success');
        } else {
          const msg = (data && data.error) ? data.error : 'Unable to send verification';
          if (status) status.textContent = msg;
          showToast(msg,'error');
        }
      } catch (e) {
        const msg = e && e.message ? e.message : 'Network or server error';
        if (status) status.textContent = msg;
        showToast(msg,'error');
      } finally { btn.disabled = false; btn.textContent = 'Send verification'; }
    });

    // preferences save: apply theme, language, etc
    document.getElementById('save-prefs').addEventListener('click', () => {
      const auth = getAuthUser(); if (!auth) return showToast('Not signed in','error');
      const prefs = { notifs: document.getElementById('pref-notifs').checked, lang: document.getElementById('pref-lang').value, date: document.getElementById('pref-date').value };
      // theme is intentionally not user-changeable; dark is enforced
      localStorage.setItem('user_prefs_'+auth.id, JSON.stringify(prefs));
      applyLanguage(prefs.lang);
      showToast('Preferences saved','success');
    });

    // Theme is forced dark by design; no runtime theme switching.

    // basic on-page translations for a few UI strings
    const TRANSLATIONS = {
      en: { save:'Save changes', revert:'Revert', export:'Download my data', prefsSaved:'Preferences saved' },
      es: { save:'Guardar cambios', revert:'Revertir', export:'Descargar mis datos', prefsSaved:'Preferencias guardadas' },
      fr: { save:'Enregistrer', revert:'Réinitialiser', export:'Télécharger mes données', prefsSaved:'Préférences enregistrées' }
    };
    function applyLanguage(lang){
      try{ document.documentElement.lang = lang; }catch(e){}
      const t = TRANSLATIONS[lang]||TRANSLATIONS.en;
      document.getElementById('save-profile').textContent = t.save;
      document.getElementById('refresh-profile').textContent = t.revert;
      document.getElementById('export-account').textContent = t.export;
    }

    // two-factor setup flows (mock)
    function showTwoFASetup(type){
      const area = document.getElementById('twofa-setup-area'); area.style.display='block'; area.innerHTML = '';
      if (type==='totp'){
        area.innerHTML = `<div><div class="note">Scan this QR with your authenticator app or use the secret below.</div><div style="margin-top:8px;background:#0b122033;padding:12px;border-radius:8px"><div style="height:120px;background:#111;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#666">QR Placeholder</div><div style="margin-top:8px">Secret: <code id=totp-secret>ABCD-EFGH-IJKL</code></div></div><div class=\"row\" style=\"margin-top:12px\"><button class=\"btn primary\" id=begin-totp>Continue to verify</button><button class=\"btn\" id=cancel-totp>Cancel</button></div></div>`;
        area.querySelector('#begin-totp').addEventListener('click', ()=>{
          // show code input to verify TOTP with backend
          const secret = area.querySelector('#totp-secret').textContent || '';
          area.innerHTML = `<div><label>Enter code from your authenticator</label><input id=twofa-code class=\"input\" placeholder=\"123456\" /><div class=\"row\" style=\"margin-top:12px\"><button class=\"btn primary\" id=verify-totp>Verify</button><button class=\"btn\" id=cancel-totp>Cancel</button></div><div id=twofa-verify-result class=\"note\" style=\"margin-top:8px\"></div></div>`;
          area.querySelector('#verify-totp').addEventListener('click', async ()=>{
            const code = area.querySelector('#twofa-code').value.trim(); const res = area.querySelector('#twofa-verify-result'); if(!code) return showToast('Enter code','error'); res.textContent='Verifying...';
            try{
              const resp = await fetch('/api/auth/verify-code',{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ method:'totp', secret, code }) });
              const data = await resp.json().catch(()=>({}));
              if(!resp.ok) { res.textContent = data.error || 'Verification failed'; throw new Error(data.error||'Verification failed'); }
              // success
              const auth = getAuthUser(); if(auth){ const prefs = JSON.parse(localStorage.getItem('user_prefs_'+auth.id)||'{}'); prefs.twofa={method:'totp',enabled:true}; localStorage.setItem('user_prefs_'+auth.id, JSON.stringify(prefs)); document.getElementById('twofa-status').textContent = '2FA enabled (TOTP)'; ensureDisableButton(); }
              showToast('TOTP enabled','success'); area.style.display='none';
            }catch(e){ if(!res.textContent) res.textContent='Verification failed'; }
          });
          area.querySelector('#cancel-totp').addEventListener('click', ()=>area.style.display='none');
        });
        area.querySelector('#cancel-totp').addEventListener('click', ()=>{ area.style.display='none'; });
      } else if (type==='sms'){
        area.innerHTML = `<div><label>Phone number</label><input id=twofa-phone class=\"input\" placeholder=\"+1 555 555 5555\" /><div class=\"row\" style=\"margin-top:10px\"><button class=\"btn primary\" id=send-sms>Send code</button><button class=\"btn\" id=cancel-sms>Cancel</button></div><div id=twofa-sms-result class=\"note\" style=\"margin-top:8px\"></div></div>`;
        area.querySelector('#send-sms').addEventListener('click', async ()=>{
          const phone=area.querySelector('#twofa-phone').value.trim(); if(!phone) return showToast('Enter phone','error');
          const result=area.querySelector('#twofa-sms-result'); result.textContent='Sending...';
          try{
            const resp=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ phone })});
            const data = await resp.json().catch(()=>({}));
            if(!resp.ok){ result.textContent = data.error || 'Unable to send SMS'; throw new Error(data.error||'Unable to send SMS'); }
            // show code entry UI to verify
            area.innerHTML = `<div><label>Enter the code you received</label><input id=twofa-code class=\"input\" placeholder=\"123456\" /><div class=\"row\" style=\"margin-top:12px\"><button class=\"btn primary\" id=verify-sms>Verify</button><button class=\"btn\" id=cancel-sms>Cancel</button></div><div id=twofa-verify-result class=\"note\" style=\"margin-top:8px\"></div></div>`;
            area.querySelector('#verify-sms').addEventListener('click', async ()=>{
              const code = area.querySelector('#twofa-code').value.trim(); const r = area.querySelector('#twofa-verify-result'); if(!code) return showToast('Enter code','error'); r.textContent='Verifying...';
              try{ const resp2 = await fetch('/api/auth/verify-code',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ method:'sms', phone, code }) }); const d2 = await resp2.json().catch(()=>({})); if(!resp2.ok){ r.textContent = d2.error || 'Verification failed'; throw new Error(d2.error||'Verification failed'); }
                const auth = getAuthUser(); if(auth){ const prefs = JSON.parse(localStorage.getItem('user_prefs_'+auth.id)||'{}'); prefs.twofa={method:'sms',phone,enabled:true}; localStorage.setItem('user_prefs_'+auth.id, JSON.stringify(prefs)); document.getElementById('twofa-status').textContent = '2FA enabled (SMS)'; ensureDisableButton(); }
                showToast('SMS two-factor enabled','success'); area.style.display='none';
              }catch(err){ if(!r.textContent) r.textContent='Verification failed'; }
            });
            area.querySelector('#cancel-sms').addEventListener('click', ()=>area.style.display='none');
          }catch(e){ if(!result.textContent) result.textContent='Unable to send SMS: backend unreachable'; }
        });
        area.querySelector('#cancel-sms').addEventListener('click', ()=>area.style.display='none');
      } else if (type==='email'){
        area.innerHTML = `<div><div class=\"note\">A one-time code will be sent to your email address.</div><div class=\"row\" style=\"margin-top:10px\"><button class=\"btn primary\" id=send-email-code>Send code</button><button class=\"btn\" id=cancel-email>Cancel</button></div><div id=twofa-email-result class=\"note\" style=\"margin-top:8px\"></div></div>`;
        area.querySelector('#send-email-code').addEventListener('click', async ()=>{
          const auth=getAuthUser(); if(!auth) return showToast('Not signed in','error');
          const users=getLocalUsers(); const me=users.find(u=>u.id===auth.id)||auth; const res=area.querySelector('#twofa-email-result'); res.textContent='Sending...';
          try{
            const resp=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ email: me.email })});
            const data = await resp.json().catch(()=>({}));
            if(!resp.ok){ res.textContent = data.error || 'Unable to send email code'; throw new Error(data.error||'Unable to send email code'); }
            // show verify UI
            area.innerHTML = `<div><label>Enter the code sent to your email</label><input id=twofa-code class=\"input\" placeholder=\"123456\" /><div class=\"row\" style=\"margin-top:12px\"><button class=\"btn primary\" id=verify-email>Verify</button><button class=\"btn\" id=cancel-email>Cancel</button></div><div id=twofa-verify-result class=\"note\" style=\"margin-top:8px\"></div></div>`;
            area.querySelector('#verify-email').addEventListener('click', async ()=>{
              const code = area.querySelector('#twofa-code').value.trim(); const r = area.querySelector('#twofa-verify-result'); if(!code) return showToast('Enter code','error'); r.textContent='Verifying...';
              try{ const resp2 = await fetch('/api/auth/verify-code',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ method:'email', email: me.email, code }) }); const d2 = await resp2.json().catch(()=>({})); if(!resp2.ok){ r.textContent = d2.error || 'Verification failed'; throw new Error(d2.error||'Verification failed'); }
                const prefs = JSON.parse(localStorage.getItem('user_prefs_'+auth.id)||'{}'); prefs.twofa={method:'email',enabled:true}; localStorage.setItem('user_prefs_'+auth.id, JSON.stringify(prefs)); document.getElementById('twofa-status').textContent = '2FA enabled (Email)'; ensureDisableButton();
                showToast('Email two-factor enabled','success'); area.style.display='none';
              }catch(err){ if(!r.textContent) r.textContent='Verification failed'; }
            });
            area.querySelector('#cancel-email').addEventListener('click', ()=>area.style.display='none');
          }catch(e){ if(!res.textContent) res.textContent='Unable to send email code: backend error'; }
        });
        area.querySelector('#cancel-email').addEventListener('click', ()=>area.style.display='none');
      }
    }

    document.getElementById('setup-totp').addEventListener('click', ()=>showTwoFASetup('totp'));
    document.getElementById('setup-sms').addEventListener('click', ()=>showTwoFASetup('sms'));
    document.getElementById('setup-email-2fa').addEventListener('click', ()=>showTwoFASetup('email'));

    function ensureDisableButton(){
      const st = document.getElementById('twofa-status'); if(!st) return;
      // add a disable button if not present
      if (!document.getElementById('disable-2fa')){
        const btn = document.createElement('button'); btn.id='disable-2fa'; btn.className='btn'; btn.textContent='Disable 2FA'; btn.style.marginLeft='10px'; btn.addEventListener('click', ()=>{ if(!confirm('Disable two-factor authentication?')) return; const auth=getAuthUser(); if(!auth) return showToast('Not signed in','error'); const prefs = JSON.parse(localStorage.getItem('user_prefs_'+auth.id)||'{}'); delete prefs.twofa; localStorage.setItem('user_prefs_'+auth.id, JSON.stringify(prefs)); st.textContent='2FA not enabled'; btn.remove(); showToast('Two-factor authentication disabled','success'); });
        st.parentNode && st.parentNode.appendChild(btn);
      }
    }

    document.getElementById('export-account').addEventListener('click', () => {
      const auth = getAuthUser(); if (!auth) return showToast('Not signed in','error');
      const users = getLocalUsers(); const me = users.find(u=>u.id===auth.id||u.email===auth.email) || auth;
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), user: me }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download = `account_${me.username||me.id}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      showToast('Account exported','success');
    });

    document.getElementById('migrate-account').addEventListener('click', async () => {
      const auth = getAuthUser(); if (!auth) return showToast('Not signed in','error');
      const users = getLocalUsers(); const me = users.find(u=>u.id===auth.id||u.email===auth.email) || auth;
      if (!confirm('Attempt to migrate this account to the running backend?')) return;
      try {
        const resp = await fetch('/api/admin/import-local-users', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ users: [me] }) });
        const data = await resp.json(); if (resp.ok) { showToast('Migrated to server', 'success'); } else { showToast(data.error || 'Server import failed', 'error'); }
      } catch (e) { showToast('Backend unreachable — export instead', 'error'); }
    });

    document.getElementById('delete-account').addEventListener('click', () => {
      if (!confirm('Delete your account locally? This cannot be undone.')) return;
      const auth = getAuthUser(); if (!auth) return showToast('Not signed in','error');
      const users = getLocalUsers(); const remaining = users.filter(u => !(u.id===auth.id || u.email===auth.email));
      saveLocalUsers(remaining); clearAuth(); showToast('Account deleted locally','success'); setTimeout(()=>location.href='../index.html',900);
    });

    // load on ready
    document.addEventListener('DOMContentLoaded', loadAccount);
  