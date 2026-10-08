'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { HttpError } = require('./http');

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 6 * 1024 * 1024;

function createUploadStore(dir) {
  fs.mkdirSync(dir, { recursive: true });

  // Accepts a data URL ("data:image/jpeg;base64,...") and returns its public URL.
  function saveDataUrl(dataUrl) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
    if (!match) throw new HttpError(400, 'Image invalide (formats acceptés : JPEG, PNG, WebP)');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) throw new HttpError(400, 'Image vide');
    if (buffer.length > MAX_BYTES) throw new HttpError(413, 'Image trop lourde (6 Mo maximum)');
    if (!matchesSignature(match[1], buffer)) throw new HttpError(400, 'Le contenu ne correspond pas au format annoncé');
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${MIME_EXT[match[1]]}`;
    fs.writeFileSync(path.join(dir, name), buffer);
    return `/uploads/${name}`;
  }

  // Copies a stored file under a new name (a request keeps its photo even if the original is replaced).
  function copy(url) {
    if (!url || !String(url).startsWith('/uploads/')) return null;
    const src = path.join(dir, path.basename(url));
    if (!fs.existsSync(src)) return null;
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${path.extname(src)}`;
    fs.copyFileSync(src, path.join(dir, name));
    return `/uploads/${name}`;
  }

  function remove(url) {
    if (!url || !String(url).startsWith('/uploads/')) return;
    const name = path.basename(url);
    fs.rmSync(path.join(dir, name), { force: true });
  }

  // Resolves an image field from a request body:
  //   undefined -> keep current, null/'' -> remove, data URL -> replace, other string -> keep as is.
  function resolveImage(value, current) {
    if (value === undefined) return current;
    if (value === null || value === '') {
      remove(current);
      return null;
    }
    if (String(value).startsWith('data:')) {
      const url = saveDataUrl(value);
      remove(current);
      return url;
    }
    return current;
  }

  return { dir, saveDataUrl, copy, remove, resolveImage };
}

function matchesSignature(mime, buf) {
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === 'image/png') return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/webp') return buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  return false;
}

module.exports = { createUploadStore };
