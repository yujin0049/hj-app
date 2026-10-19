/* 잠금용 암호화. 내용(기관·사람·금액)은 여기 두지 않아요. */
(function (root) {
  'use strict';
  var te = new TextEncoder();
  var td = new TextDecoder();

  function b64(bytes) {
    var s = '';
    var arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(secret, salt, iterations) {
    var base = await crypto.subtle.importKey('raw', te.encode(String(secret)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptWithKey(obj, key, meta) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, te.encode(JSON.stringify(obj))));
    return {
      sealed: true,
      format: 'admin-practice-sealed',
      formatVersion: 1,
      kdf: 'PBKDF2-SHA256',
      iter: meta.iter,
      salt: meta.salt,
      iv: b64(iv),
      ct: b64(ct)
    };
  }

  async function encryptJson(obj, secret, iterations) {
    var iter = iterations || 100000;
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var key = await deriveKey(secret, salt, iter);
    var env = await encryptWithKey(obj, key, { iter: iter, salt: b64(salt) });
    return { env: env, key: key };
  }

  async function decryptJson(env, secret) {
    if (!env || !env.sealed || !env.ct) return { ok: false, error: 'format' };
    try {
      var salt = unb64(env.salt);
      var iv = unb64(env.iv);
      var key = await deriveKey(secret, salt, env.iter);
      var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, unb64(env.ct));
      return { ok: true, value: JSON.parse(td.decode(pt)), key: key };
    } catch (e) {
      return { ok: false, error: 'auth' };
    }
  }

  var api = { b64: b64, unb64: unb64, deriveKey: deriveKey, encryptWithKey: encryptWithKey, encryptJson: encryptJson, decryptJson: decryptJson };
  root.APCrypto = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
