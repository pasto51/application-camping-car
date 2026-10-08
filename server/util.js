'use strict';

const { HttpError } = require('./http');

const JSON_COLUMNS = new Set(['specs', 'photos']);

// snake_case row -> camelCase object, decoding JSON columns.
function camel(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const k = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[k] = JSON_COLUMNS.has(key) && typeof value === 'string' ? safeJson(value, []) : value;
  }
  return out;
}

function camelAll(rows) {
  return rows.map(camel);
}

function safeJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// Optional trimmed string limited to max chars; undefined stays undefined (field not sent).
function optStr(value, max = 500) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim().slice(0, max);
  return s === '' ? null : s;
}

function reqStr(value, label, max = 500) {
  const s = optStr(value, max);
  if (!s) throw new HttpError(400, `${label} obligatoire`);
  return s;
}

function optInt(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new HttpError(400, 'Identifiant invalide');
  return n;
}

function reqInt(value, label) {
  const n = optInt(value);
  if (n == null) throw new HttpError(400, `${label} obligatoire`);
  return n;
}

function optEmail(value) {
  const s = optStr(value, 200);
  if (s == null) return s;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new HttpError(400, 'Adresse e-mail invalide');
  return s.toLowerCase();
}

function optDate(value) {
  const s = optStr(value, 10);
  if (s == null) return s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'Date invalide (AAAA-MM-JJ)');
  return s;
}

function bool01(value, fallback) {
  if (value === undefined) return fallback;
  return value ? 1 : 0;
}

// Specs are a list of {label, value} pairs shown on the vehicle sheet.
function normalizeSpecs(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new HttpError(400, 'Caractéristiques invalides');
  return JSON.stringify(
    value
      .map((s) => ({ label: optStr(s && s.label, 80), value: optStr(s && s.value, 200) }))
      .filter((s) => s.label && s.value)
      .slice(0, 50)
  );
}

// Keeps the existing value when the field was not sent.
function pick(next, current) {
  return next === undefined ? current : next;
}

module.exports = { camel, camelAll, safeJson, optStr, reqStr, optInt, reqInt, optEmail, optDate, bool01, normalizeSpecs, pick };
