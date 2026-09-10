require('dotenv').config({ path: '.env.local' });

console.log('🔍 Loading environment variables from .env.local');
console.log('KEYCLOAK_SERVER_URL:', process.env.KEYCLOAK_SERVER_URL ? '✓ SET' : '✗ NOT SET');
console.log('KEYCLOAK_ADMIN_USERNAME:', process.env.KEYCLOAK_ADMIN_USERNAME ? '✓ SET' : '✗ NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');

// Validasi environment variables
const requiredEnvVars = [
    'KEYCLOAK_SERVER_URL',
    'KEYCLOAK_REALM',
    'KEYCLOAK_ADMIN_USERNAME',
    'KEYCLOAK_ADMIN_PASSWORD'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ ERROR: ${envVar} is required but not set in .env.local`);
        console.error('Please create .env.local file in backend folder with proper credentials');
        process.exit(1);
    }
}

// ========== KEYCLOAK CONFIGURATION ==========
const KEYCLOAK_CONFIG = {
    serverUrl: process.env.KEYCLOAK_SERVER_URL,
    realm: process.env.KEYCLOAK_REALM,
    clientId: process.env.KEYCLOAK_CLIENT_ID || 'local-surat',
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME,
    adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD
};

console.log('✅ Keycloak Configuration Loaded Successfully');
console.log(`   Server: ${KEYCLOAK_CONFIG.serverUrl}`);
console.log(`   Realm: ${KEYCLOAK_CONFIG.realm}`);
console.log(`   Admin User: ${KEYCLOAK_CONFIG.adminUsername}`);

module.exports = KEYCLOAK_CONFIG;