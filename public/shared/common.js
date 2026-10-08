// Helpers shared by the customer app and the back-office.

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Multi-line text with escaped HTML and line breaks.
export function multiline(value) {
  return esc(value).replace(/\n/g, '<br>');
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createApi(getToken, onUnauthorized) {
  return async function api(method, url, body) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, 'Pas de connexion internet');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && onUnauthorized) onUnauthorized();
      // A page newer than the server: the site was updated (git pull) but not restarted.
      if (res.status === 404 && data.error === 'Route inconnue') {
        throw new ApiError(404, 'Le serveur n’est pas à jour : redémarrez le site (sur alwaysdata : Web → Sites → Redémarrer), puis rechargez la page.');
      }
      throw new ApiError(res.status, data.error || `Erreur ${res.status}`);
    }
    return data;
  };
}

// Reads an image file, downsizes it and returns a JPEG data URL (keeps uploads light on mobile networks).
export function compressImage(file, { maxSize = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Fichier image attendu'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire l'image"));
    };
    img.src = url;
  });
}

// Opens the file picker (camera on mobile when capture is true) and resolves with a compressed data URL, or null.
export function pickImage({ capture = false, multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = multiple;
    if (capture) input.capture = 'environment';
    input.onchange = async () => {
      const files = [...(input.files || [])];
      if (!files.length) return resolve(multiple ? [] : null);
      try {
        const out = await Promise.all(files.map((f) => compressImage(f)));
        resolve(multiple ? out : out[0]);
      } catch (err) {
        alert(err.message);
        resolve(multiple ? [] : null);
      }
    };
    input.click();
  });
}

let toastTimer;
export function toast(message, type = 'ok') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
  }
  // An open modal dialog sits in the top layer: put the toast inside it so it stays visible.
  const host = document.querySelector('dialog[open]') || document.body;
  if (el.parentNode !== host) host.appendChild(el);
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3200);
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value;
  }
  return out;
}
