// File: db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bpom_arsip_surat',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Fungsi untuk callback style (compatibel dengan kode lama)
const queryWithCallback = (sql, params, callback) => {
    pool.query(sql, params)
        .then(([results, fields]) => {
            if (callback) callback(null, results, fields);
        })
        .catch(err => {
            if (callback) callback(err, null, null);
        });
};

// Export kedua versi
module.exports = {
    // Promise version
    query: pool.query.bind(pool),
    getConnection: pool.getConnection.bind(pool),
    
    // Callback version untuk compatibility
    queryWithCallback,
    
    // Pool object
    pool
};