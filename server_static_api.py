#!/usr/bin/env python3
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import time

DATA_FILE = 'data/mock_users.json'

os.makedirs('data', exist_ok=True)

def load_users():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def save_users(users):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=2)

def email_sending_enabled():
    cfgf = 'data/email_config.json'
    try:
        with open(cfgf, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
            return cfg.get('enabled', False)
    except Exception:
        return False

class Handler(SimpleHTTPRequestHandler):
    def _send_json(self, obj, code=200):
        b = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        # CORS + JSON headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        # small artificial latency to mimic real backend
        time.sleep(0.12)
        length = int(self.headers.get('Content-Length','0'))
        body = self.rfile.read(length).decode('utf-8') if length else ''
        try:
            data = json.loads(body) if body else {}
        except Exception:
            data = {}

        # simple API: /api/auth/signup, /api/auth/login, /api/admin/import-local-users
        if path == '/api/auth/signup':
            users = load_users()
            username = (data.get('username') or data.get('identifier') or '').strip()
            email = (data.get('email') or '').strip().lower()
            password = data.get('password') or data.get('password_hash') or data.get('pw') or ''
            if not username or not email or not password:
                return self._send_json({'error':'missing fields'}, 400)
            if any(u for u in users if u.get('username','').lower()==username.lower() or u.get('email','')==email):
                return self._send_json({'error':'user exists'}, 409)
            new = {
                'id': f'local-{len(users)+1}',
                'username': username,
                'email': email,
                'password_hash': password
            }
            users.append(new)
            save_users(users)
            return self._send_json({'user': {'id': new['id'], 'username': new['username'], 'email': new['email']}, 'token': 'mock-token'})

        if path == '/api/auth/login':
            users = load_users()
            identifier = (data.get('identifier') or data.get('username') or data.get('email') or '').strip()
            password = data.get('password') or ''
            user = None
            for u in users:
                if u.get('username','').lower() == identifier.lower() or u.get('email','').lower() == identifier.lower():
                    user = u; break
            if not user:
                return self._send_json({'error':'user not found'}, 404)
            # accept if passwords match raw or match stored password_hash
            if password != user.get('password_hash') and password != user.get('password'):
                return self._send_json({'error':'invalid credentials'}, 401)
            return self._send_json({'user': {'id': user['id'], 'username': user['username'], 'email': user['email']}, 'token': 'mock-token'})

        if path == '/api/auth/send-code':
            # generate a reset code and persist it
            email = (data.get('email') or data.get('identifier') or '').strip().lower()
            if not email:
                return self._send_json({'error':'missing email'}, 400)
            users = load_users()
            if not any(u for u in users if u.get('email','')==email):
                return self._send_json({'error':'no local user for that email'}, 404)
            codes_file = 'data/pw_reset_codes.json'
            try:
                with open(codes_file,'r',encoding='utf-8') as f: codes = json.load(f)
            except Exception:
                codes = []
            code = str(int(100000 + (time.time() * 1000) % 900000))
            codes.append({'email': email, 'code': code, 'expires': int(time.time() * 1000) + 10 * 60 * 1000})
            with open(codes_file,'w',encoding='utf-8') as f: json.dump(codes,f,indent=2)
            return self._send_json({'ok': True, 'code': code})

        if path == '/api/auth/send-reset-link':
            # send a reset link if email sending is enabled
            email = (data.get('email') or data.get('identifier') or '').strip().lower()
            if not email:
                return self._send_json({'error':'missing email'}, 400)
            users = load_users()
            if not any(u for u in users if u.get('email','')==email):
                return self._send_json({'error':'no local user for that email'}, 404)
            if not email_sending_enabled():
                return self._send_json({'error':'email sending not configured'}, 500)
            # create token
            token = str(int(time.time()*1000)) + '-' + str(len(email) + 1)
            tokens_file = 'data/reset_tokens.json'
            try:
                with open(tokens_file,'r',encoding='utf-8') as f: tokens = json.load(f)
            except Exception:
                tokens = []
            tokens.append({'email': email, 'token': token, 'expires': int(time.time()*1000) + 24*60*60*1000})
            with open(tokens_file,'w',encoding='utf-8') as f: json.dump(tokens,f,indent=2)
            # produce a dev-only link
            link = f'http://127.0.0.1:3000/pages/reset.html?token={token}&email={email}'
            return self._send_json({'ok': True, 'link': link})

        if path == '/api/auth/verify-code':
            email = (data.get('email') or '').strip().lower()
            code = str(data.get('code') or '')
            codes_file = 'data/pw_reset_codes.json'
            try:
                with open(codes_file,'r',encoding='utf-8') as f: codes = json.load(f)
            except Exception:
                codes = []
            now = int(time.time() * 1000)
            match = next((c for c in codes if c.get('email')==email and c.get('code')==code and c.get('expires',0) > now), None)
            if not match:
                return self._send_json({'error':'invalid or expired code'}, 400)
            return self._send_json({'ok': True})

        if path == '/api/auth/verify-token':
            token = (data.get('token') or '').strip()
            email = (data.get('email') or '').strip().lower()
            tokens_file = 'data/reset_tokens.json'
            try:
                with open(tokens_file,'r',encoding='utf-8') as f: tokens = json.load(f)
            except Exception:
                tokens = []
            now = int(time.time()*1000)
            match = next((t for t in tokens if t.get('token')==token and t.get('email')==email and t.get('expires',0) > now), None)
            if not match:
                return self._send_json({'error':'invalid or expired token'}, 400)
            return self._send_json({'ok': True})

        if path == '/api/auth/reset-password':
            # support token-based reset or direct email-based reset
            token = (data.get('token') or '').strip()
            email = (data.get('email') or '').strip().lower()
            newPassword = data.get('newPassword') or data.get('password') or ''
            if not newPassword:
                return self._send_json({'error':'missing new password'}, 400)
            if token:
                tokens_file = 'data/reset_tokens.json'
                try:
                    with open(tokens_file,'r',encoding='utf-8') as f: tokens = json.load(f)
                except Exception:
                    tokens = []
                now = int(time.time()*1000)
                match = next((t for t in tokens if t.get('token')==token and t.get('email')==email and t.get('expires',0) > now), None)
                if not match:
                    return self._send_json({'error':'invalid or expired token'}, 400)
                # consume token
                tokens = [t for t in tokens if not (t.get('token')==token and t.get('email')==email)]
                with open(tokens_file,'w',encoding='utf-8') as f: json.dump(tokens,f,indent=2)
            else:
                if not email:
                    return self._send_json({'error':'missing email'}, 400)
            users = load_users()
            idx = next((i for i,u in enumerate(users) if u.get('email')==email), -1)
            if idx == -1:
                return self._send_json({'error':'user not found'}, 404)
            users[idx]['password_hash'] = newPassword
            save_users(users)
            return self._send_json({'ok': True})

        if path == '/api/admin/import-local-users':
            users = data.get('users') or []
            existing = load_users()
            for u in users:
                if not any(ex.get('email')==u.get('email') for ex in existing):
                    existing.append({'id': u.get('id') or f'migr-{len(existing)+1}', 'username': u.get('username'), 'email': u.get('email'), 'password_hash': u.get('password_hash','')})
            save_users(existing)
            return self._send_json({'ok': True, 'imported': len(users)})

        # unknown API
        return self._send_json({'error':'not found'}, 404)


if __name__ == '__main__':
    port = 3000
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f"Serving static files + mock API on http://127.0.0.1:{port}")
    server.serve_forever()
