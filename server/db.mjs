import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const file = resolve(process.env.DATABASE_PATH || 'data/mentor.sqlite');
mkdirSync(dirname(file), { recursive: true });
export const db = new DatabaseSync(file);
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT,
 verified INTEGER NOT NULL DEFAULT 0, google_sub TEXT UNIQUE, created INTEGER NOT NULL,
 school TEXT DEFAULT '', grade TEXT DEFAULT '', bio TEXT DEFAULT '', avatar TEXT DEFAULT '',
 prefs TEXT NOT NULL DEFAULT '{"channel":"app","frequency":"event","time":"18:00","theme":"light","font":100}',
 accepted_version TEXT NOT NULL DEFAULT '2026-10-19-academica'
);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL, hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS reviews (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5), comment TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, message TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS deliveries (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, message TEXT NOT NULL, due INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS oauth (state TEXT PRIMARY KEY, verifier TEXT NOT NULL, nonce TEXT NOT NULL, expires INTEGER NOT NULL);
`);
export const getUser = id => db.prepare('SELECT * FROM users WHERE id=?').get(id);
export const findEmail = e => db.prepare('SELECT * FROM users WHERE email=?').get(e);
export function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, school: u.school, grade: u.grade, bio: u.bio, avatar: u.avatar, created: u.created, hasPassword: Boolean(u.password), google: Boolean(u.google_sub), prefs: JSON.parse(u.prefs) };
}
export function cleanup() {
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
  db.prepare('DELETE FROM challenges WHERE expires<?').run(now);
  db.prepare('DELETE FROM oauth WHERE expires<?').run(now);
  db.prepare('DELETE FROM users WHERE verified=0 AND created<?').run(now - 86400000);
  db.prepare('DELETE FROM notices WHERE created<?').run(now - 30 * 86400000);
}
