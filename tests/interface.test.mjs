import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../login/app.js', import.meta.url), 'utf8');
function context() {
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const c = vm.createContext({ document: { querySelector: () => ({}), addEventListener: () => {} }, window: { addEventListener: () => {} }, sessionStorage: storage, localStorage: storage, URLSearchParams, console });
  vm.runInContext(source.slice(0, source.lastIndexOf('(async () => {')), c);
  vm.runInContext(`config={localMailbox:true,google:false,development:true};available=true;user={name:'Marina <script>alert(1)</script>',email:'teste@example.com',school:'Escola',bio:'<img src=x onerror=alert(1)>',grade:'2º ano',avatar:'',hasPassword:true,prefs:{theme:'light',font:100,channel:'app',frequency:'event',time:'18:00'}};`, c);
  return c;
}
function structure(html, label) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
  assert.equal(ids.length, new Set(ids).size, `IDs únicos: ${label}`);
  for (const x of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(x[1]), `Rótulo associado: ${label} ${x[1]}`);
  assert.ok(!html.includes('<script>alert(1)</script>'), `Nome escapado: ${label}`);
  assert.ok(!html.includes('<img src=x onerror='), `Biografia escapada: ${label}`);
}
test('Telas de conta preservam rótulos, IDs únicos e escapam dados do usuário', () => {
  const c = context();
  for (const view of ['viewHome([])', 'viewProfile()', 'viewNotifications()', 'viewAccessibility()', 'viewSecurity()', 'viewSupport()', 'viewReview(null)', 'viewLegal()', "legalDocument('privacy')", "legalDocument('terms')"]) structure(vm.runInContext(view, c), view);
  for (const purpose of ['password', 'delete']) { vm.runInContext(`pending={purpose:'${purpose}',challenge:'teste'}`, c); structure(vm.runInContext('viewSecurity()', c), 'Segurança: ' + purpose); }
});
test('Telas de acesso têm formulários acessíveis e distinguem servidor indisponível', () => {
  const c = context(); vm.runInContext("user=null;pending={purpose:'verify',challenge:'teste',consent:true}", c);
  for (const route of ['login','register','recover','confirm','reset']) structure(vm.runInContext(`authView('${route}',new URLSearchParams())`, c), route);
  vm.runInContext('available=false', c);
  const offline = vm.runInContext("authView('login',new URLSearchParams())", c);
  assert.ok(offline.includes('Aplicação sem conexão com o servidor.'));
  assert.ok(/type="submit" disabled/.test(offline));
});
