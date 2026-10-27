// Envio por SMTP com TLS direto (porta 465), sem dependências. Usado quando SMTP_* está no .env.
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
export const smtpConfigurado = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);

export function enviarSmtp(to, subject, text, { verificarApenas = false } = {}) {
  const host = process.env.SMTP_HOST, from = process.env.MAIL_FROM, remetente = /<([^>]+)>/.exec(from)?.[1] || from;
  const corpo = b64(text).replace(/.{76}/g, '$&\r\n');
  const mensagem = [`From: ${from.replace(/^([^<]+)</, (_, n) => `=?UTF-8?B?${b64(n.trim())}?= <`)}`, `To: <${to}>`, `Subject: =?UTF-8?B?${b64(subject)}?=`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(12).toString('hex')}@${remetente.split('@')[1]}>`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', corpo].join('\r\n');
  const passos = [['', 220], [`EHLO mentor-ia`, 250], ['AUTH LOGIN', 334], [b64(process.env.SMTP_USER), 334], [b64(process.env.SMTP_PASS), 235],
    ...(verificarApenas ? [] : [[`MAIL FROM:<${remetente}>`, 250], [`RCPT TO:<${to}>`, 250], ['DATA', 354], [mensagem + '\r\n.', 250]]), ['QUIT', 221]];
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: Number(process.env.SMTP_PORT || 465), servername: host });
    let buffer = '', i = 0;
    const falhar = erro => { socket.destroy(); reject(erro); };
    socket.setTimeout(15000, () => falhar(new Error('SMTP sem resposta.')));
    socket.on('error', falhar);
    socket.on('data', chunk => {
      buffer += chunk;
      const linhas = buffer.split('\r\n'); if (!/^\d{3} /.test(linhas.at(-2) || '')) return;
      const codigo = Number(linhas.at(-2).slice(0, 3)); buffer = '';
      // Nunca registra o conteúdo trocado: pode conter credencial ou código.
      if (codigo !== passos[i][1]) return falhar(new Error(`SMTP recusou a etapa ${i} (código ${codigo}).`));
      if (++i === passos.length) { socket.end(); return resolve(); }
      socket.write(passos[i][0] + '\r\n');
    });
  });
}
