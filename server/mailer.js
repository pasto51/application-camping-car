'use strict';

// Minimal SMTP client (no dependency): SSL on port 465, or STARTTLS on 587 / 25, with AUTH LOGIN.

const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

function encodeHeader(text) {
  // Non-ASCII headers (accents) are sent as UTF-8 encoded words.
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

// "Name <address>" with the name encoded when it has accents; the address alone stays as is.
function formatAddress(name, address) {
  if (!name) return address;
  const safe = String(name).replace(/[\r\n"<>]/g, ' ').trim();
  return `${/^[\x20-\x7e]*$/.test(safe) ? `"${safe}"` : encodeHeader(safe)} <${address}>`;
}

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');

function buildMessage({ from, to, subject, text, html, replyTo }) {
  const lines = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${(from.match(/@([^>\s]+)/) || [])[1] || 'localhost'}>`,
    'MIME-Version: 1.0',
    // Automatic message: out-of-office replies must not answer it (no mail loops).
    'Auto-Submitted: auto-generated',
    'X-Auto-Response-Suppress: All',
  ];
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  if (!html) {
    lines.push('Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64');
    return lines.join('\r\n') + '\r\n\r\n' + b64(text) + '\r\n';
  }
  const boundary = `cdb-${crypto.randomBytes(10).toString('hex')}`;
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  const part = (type, content) => `--${boundary}\r\nContent-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(content)}\r\n`;
  return lines.join('\r\n') + '\r\n\r\n' + part('text/plain', text) + part('text/html', html) + `--${boundary}--\r\n`;
}

// Sends one e-mail; resolves when the server accepted it, rejects with a readable error otherwise.
function sendMail(config, mail, { timeoutMs = 20000 } = {}) {
  const { host, port = 587, user, pass } = config;
  // The sender address never changes (deliverability); only the displayed name can (e.g. the dealership).
  const from = config.from && mail.fromName ? formatAddress(mail.fromName, (String(config.from).match(/<([^>]+)>/) || [null, config.from])[1].trim()) : config.from;
  const secure = config.secure ?? Number(port) === 465; // SSL from the start (465), otherwise STARTTLS when offered
  const to = (Array.isArray(mail.to) ? mail.to : [mail.to]).filter(Boolean);
  if (!host || !from) return Promise.reject(new Error('Envoi des e-mails non configuré'));
  if (!to.length) return Promise.reject(new Error('Aucun destinataire'));
  const address = (s) => (String(s).match(/<([^>]+)>/) || [null, s])[1].trim();

  return new Promise((resolve, reject) => {
    let socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    let buffer = '';
    let waiting = null;
    let done = false;
    const timer = setTimeout(() => fail(new Error('Le serveur d’e-mails ne répond pas')), timeoutMs);

    function fail(err) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    }

    function attach(s) {
      s.setEncoding('utf8');
      s.on('data', (chunk) => {
        buffer += chunk;
        // A reply is complete when its last line is "NNN text" (not "NNN-text").
        const m = buffer.match(/(?:^|\r\n)(\d{3}) [^\r\n]*\r\n$/);
        if (m && waiting) {
          const reply = { code: Number(m[1]), text: buffer.trim() };
          buffer = '';
          const w = waiting;
          waiting = null;
          w(reply);
        }
      });
      s.on('error', (e) => fail(new Error(`Connexion au serveur d’e-mails impossible : ${e.message}`)));
    }

    const read = () => new Promise((r) => (waiting = r));
    async function cmd(line, expect) {
      if (line !== null) socket.write(line + '\r\n');
      const reply = await read();
      if (!expect.includes(reply.code)) throw new Error(`Refus du serveur d’e-mails (${reply.text.split('\r\n').pop()})`);
      return reply;
    }

    attach(socket);
    (async () => {
      await cmd(null, [220]);
      let ehlo = await cmd('EHLO compagnon-de-bord', [250]);
      if (!(socket instanceof tls.TLSSocket) && /STARTTLS/i.test(ehlo.text)) {
        await cmd('STARTTLS', [220]);
        socket.removeAllListeners('data');
        socket = tls.connect({ socket, servername: host });
        attach(socket);
        await new Promise((r, j) => {
          socket.once('secureConnect', r);
          socket.once('error', j);
        });
        ehlo = await cmd('EHLO compagnon-de-bord', [250]);
      }
      if (user) {
        await cmd('AUTH LOGIN', [334]);
        await cmd(Buffer.from(user).toString('base64'), [334]);
        await cmd(Buffer.from(pass || '').toString('base64'), [235]);
      }
      await cmd(`MAIL FROM:<${address(from)}>`, [250]);
      for (const rcpt of to) await cmd(`RCPT TO:<${address(rcpt)}>`, [250, 251]);
      await cmd('DATA', [354]);
      const data = buildMessage({ from, to, subject: mail.subject, text: mail.text, html: mail.html, replyTo: mail.replyTo }).replace(/\r\n\./g, '\r\n..');
      await cmd(data + '\r\n.', [250]);
      socket.write('QUIT\r\n');
      done = true;
      clearTimeout(timer);
      socket.end();
      resolve();
    })().catch(fail);
  });
}

module.exports = { sendMail, buildMessage, formatAddress };
