require('dotenv').config();

const required = [
  'DATABASE_URL',
  'JWT_SECRET', 
  'VITE_APP_ID',
  'OAUTH_SERVER_URL',
  'BUILT_IN_FORGE_API_URL',
  'BUILT_IN_FORGE_API_KEY',
];

let ok = true;
for (const key of required) {
  if (!process.env[key]) {
    console.error('FALTANDO:', key);
    ok = false;
  } else {
    console.log('OK:', key, '=', process.env[key].substring(0, 50));
  }
}

console.log('E2E_TESTING:', process.env.E2E_TESTING);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Status:', ok ? 'TODAS AS VARIÁVEIS OK!' : 'VARIÁVEIS FALTANDO!');
