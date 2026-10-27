import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, passwordError, email } from '../server/security.mjs';
test('Senha tem salt individual, hash verificável e política no servidor', async () => {
  assert.ok(passwordError('123456'));
  assert.ok(passwordError('Abcdefgh1234'));
  assert.equal(passwordError('SenhaForte!2026'), null);
  const first = await hashPassword('SenhaForte!2026'), second = await hashPassword('SenhaForte!2026');
  assert.notEqual(first, second);
  assert.ok(!first.includes('SenhaForte'));
  assert.equal(await verifyPassword('SenhaForte!2026', first), true);
  assert.equal(await verifyPassword('SenhaErrada!2026', first), false);
  assert.equal(email('  ALUNO@example.com '), 'aluno@example.com');
  assert.throws(() => email('<script>'));
});
