// bootstrap-admin.js
const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json'); // tu credencial

admin.initializeApp({ credential: admin.credential.cert(sa) });

(async () => {
  const targetUid = '6zQjqRSXfOdG1U1eaa4qDYLYrR53';
  await admin.auth().setCustomUserClaims(targetUid, { role: 'admin' });
  await admin.auth().revokeRefreshTokens(targetUid);
  console.log('Listo: claim admin puesto. Cierra sesión y vuelve a entrar.');
})();
