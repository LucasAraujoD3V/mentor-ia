import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const random = () => randomBytes(32).toString('base64url');
export const digest = s => createHash('sha256').update(s).digest('hex');
export const otp = () => String(randomInt(100000, 1000000));
export function passwordError(p) {
  return typeof p !== 'string' || p.length < 12 || p.length > 128 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9\s]/.test(p)
    ? 'Use de 12 a 128 caracteres, com maiúscula, minúscula, número e símbolo.' : null;
}
export async function hashPassword(p) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(p, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(p, encoded) {
  if (typeof p !== 'string' || p.length > 128 || !encoded) return false;
  const [algorithm, salt, value] = encoded.split('$');
  if (algorithm !== 'scrypt') return false;
  const key = await scrypt(p, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(value, 'hex');
  return expected.length === key.length && timingSafeEqual(key, expected);
}
export function text(value, max = 100) {
  if (typeof value !== 'string' || value.trim().length > max || /[\x00-\x08\x0b-\x1f]/.test(value)) throw Object.assign(new Error('Texto inválido ou muito longo.'), { status: 400 });
  return value.trim();
}
export function email(value) {
  const e = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw Object.assign(new Error('Informe um e-mail válido.'), { status: 400 });
  return e;
}
export const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
