const express = require('express');
const router = express.Router();
const { keycloakAuth, getUsername } = require('../middleware/keycloakAuth');
const { 
    getPPKUsersFromKeycloak, 
    getAllUsersAndFilterPPK,
    getUsersByRoleFromKeycloak
} = require('../utils/keycloakHelpers');

// ========== USER BY ROLE (mis. daftar Katim) ==========
// GET /api/keycloak/users/by-role/katim — daftar user ber-role tertentu dari Keycloak
router.get('/users/by-role/:role', keycloakAuth, async (req, res) => {
    const role = String(req.params.role || '').toLowerCase().trim();
    const allowed = ['katim', 'ppk', 'admin_arsiparis', 'bendahara', 'pic_ruangan', 'pic'];
    if (!allowed.includes(role)) {
        return res.status(400).json({ success: false, message: 'Role tidak dikenal' });
    }
    try {
        const users = await getUsersByRoleFromKeycloak(role);
        console.log(`✅ ${users.length} user role "${role}" dari Keycloak`);
        res.json({ success: true, data: users, count: users.length, role });
    } catch (e) {
        console.error(`❌ Gagal ambil user role ${role}:`, e.message);
        res.status(500).json({ success: false, message: 'Gagal mengambil daftar user dari Keycloak', error: e.message });
    }
});

// ========== PPK MANAGEMENT ROUTES ==========

// GET - Daftar PPK dari Keycloak
router.get('/ppk/list', keycloakAuth, async (req, res) => {
    const username = getUsername(req.user);
    
    console.log(`📋 ${username} mengakses daftar PPK`);
    
    try {
        // Coba ambil dari Keycloak menggunakan admin-cli
        console.log('🔐 Attempting to get PPK list from Keycloak using admin-cli...');
        
        let ppkUsers;
        try {
            // Coba metode utama
            ppkUsers = await getPPKUsersFromKeycloak();
        } catch (primaryError) {
            console.warn('⚠️ Primary method failed:', primaryError.message);
            
            // Coba metode fallback
            try {
                console.log('🔄 Trying fallback method...');
                ppkUsers = await getAllUsersAndFilterPPK();
            } catch (fallbackError) {
                console.error('❌ Fallback method also failed:', fallbackError.message);
                throw new Error(`Gagal mendapatkan daftar PPK dari Keycloak. ${fallbackError.message}`);
            }
        }
        
        if (ppkUsers.length === 0) {
            console.log('⚠️ Tidak ada user PPK ditemukan di Keycloak');
            return res.status(404).json({
                success: false,
                message: 'Tidak ada user dengan role PPK ditemukan di sistem',
                data: [],
                count: 0,
                source: 'keycloak'
            });
        }
        
        console.log(`✅ Successfully retrieved ${ppkUsers.length} PPK users from Keycloak`);
        
        // Log beberapa contoh untuk debugging
        console.log('📊 Contoh data PPK yang dikirim:');
        ppkUsers.slice(0, 3).forEach((user, index) => {
            console.log(`${index + 1}. ${user.nama} (${user.username}) - NIP: ${user.nip}`);
        });
        
        // Hanya kirim field yang diperlukan, hapus debugging fields
        const formattedUsers = ppkUsers.map(user => ({
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            nama: user.nama,
            nip: user.nip,
            jabatan: user.jabatan,
            unit_kerja: user.unit_kerja,
            enabled: user.enabled,
            email_verified: user.email_verified
        }));
        
        return res.status(200).json({
            success: true,
            message: 'Daftar PPK berhasil diambil dari Keycloak',
            data: formattedUsers,
            count: formattedUsers.length,
            source: 'keycloak',
            debug_info: {
                nama_source: 'firstName + lastName (fallback ke username)',
                sample_data: formattedUsers.slice(0, 2).map(u => ({
                    nama: u.nama,
                    username: u.username,
                    nip: u.nip
                }))
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching PPK list:', error.message);
        
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar PPK dari Keycloak',
            error: error.message,
            suggestion: 'Periksa kredensial admin dan pastikan Keycloak dapat diakses'
        });
    }
});


// GET - Search PPK berdasarkan nama atau NIP
router.get('/ppk/search', keycloakAuth, async (req, res) => {
    const { query } = req.query;
    const username = getUsername(req.user);
    
    console.log(`🔍 ${username} mencari PPK dengan query: ${query}`);
    
    if (!query || query.trim().length < 2) {
        return res.status(400).json({
            success: false,
            message: 'Query pencarian minimal 2 karakter'
        });
    }
    
    try {
        let ppkUsers;
        try {
            ppkUsers = await getPPKUsersFromKeycloak();
        } catch (error) {
            console.warn('⚠️ Primary method failed, trying fallback:', error.message);
            ppkUsers = await getAllUsersAndFilterPPK();
        }
        
        if (ppkUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tidak ada data PPK ditemukan',
                data: [],
                count: 0
            });
        }
        
        const searchTerm = query.toLowerCase();
        const filteredPPK = ppkUsers.filter(ppk => 
            ppk.nama.toLowerCase().includes(searchTerm) ||
            ppk.nip.toLowerCase().includes(searchTerm) ||
            ppk.email.toLowerCase().includes(searchTerm) ||
            (ppk.jabatan && ppk.jabatan.toLowerCase().includes(searchTerm))
        );
        
        console.log(`✅ Found ${filteredPPK.length} PPK matching search`);
        
        res.status(200).json({
            success: true,
            message: 'Pencarian PPK berhasil',
            data: filteredPPK,
            count: filteredPPK.length,
            search_query: query
        });
        
    } catch (error) {
        console.error('❌ Error searching PPK:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Gagal melakukan pencarian PPK',
            error: error.message
        });
    }
});

// GET - Detail PPK berdasarkan ID
router.get('/ppk/:id', keycloakAuth, async (req, res) => {
    const { id } = req.params;
    const username = getUsername(req.user);
    
    console.log(`👤 ${username} mengakses detail PPK ID: ${id}`);
    
    if (!id) {
        return res.status(400).json({
            success: false,
            message: 'ID PPK tidak valid'
        });
    }
    
    try {
        let ppkUsers;
        try {
            ppkUsers = await getPPKUsersFromKeycloak();
        } catch (error) {
            console.warn('⚠️ Primary method failed, trying fallback:', error.message);
            ppkUsers = await getAllUsersAndFilterPPK();
        }
        
        const foundPPK = ppkUsers.find(ppk => ppk.user_id === id);
        
        if (!foundPPK) {
            return res.status(404).json({
                success: false,
                message: 'PPK tidak ditemukan'
            });
        }
        
        console.log(`✅ Found PPK: ${foundPPK.nama}`);
        
        res.status(200).json({
            success: true,
            message: 'Detail PPK berhasil diambil',
            data: foundPPK
        });
        
    } catch (error) {
        console.error('❌ Error fetching PPK detail:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil detail PPK',
            error: error.message
        });
    }
});

// GET - Daftar semua user dari Keycloak (hanya admin)
router.get('/users', keycloakAuth, async (req, res) => {
    const username = getUsername(req.user);
    
    console.log(`👥 ${username} mengakses daftar semua user`);
    
    // Hanya admin yang bisa mengakses semua user
    if (!req.user.isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Hanya admin yang dapat mengakses daftar semua user'
        });
    }
    
    try {
        const { getAdminCliToken } = require('../utils/keycloakHelpers');
        const adminToken = await getAdminCliToken();
        
        const usersUrl = `${process.env.KEYCLOAK_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`;
        
        const response = await axios.get(usersUrl, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            params: {
                max: 100
            }
        });
        
        const users = response.data.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            enabled: user.enabled,
            emailVerified: user.emailVerified,
            createdTimestamp: user.createdTimestamp
        }));
        
        res.status(200).json({
            success: true,
            message: 'Daftar user berhasil diambil',
            data: users,
            count: users.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching users:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar user',
            error: error.message
        });
    }
});



// VERSI ALTERNATIF YANG LEBIH SIMPLE
// GET - Daftar semua user simple (tidak perlu admin)
router.get('/users/all-simple', keycloakAuth, async (req, res) => {
    const username = getUsername(req.user);
    
    console.log(`👥 ${username} mengakses daftar semua user (simple)`);
    
    try {
        const axios = require('axios');
        const { getAdminCliToken } = require('../utils/keycloakHelpers');
        
        // Log environment untuk debugging
        console.log('🔧 Environment variables check:');
        console.log('- KEYCLOAK_SERVER_URL:', process.env.KEYCLOAK_SERVER_URL);
        console.log('- KEYCLOAK_REALM:', process.env.KEYCLOAK_REALM);
        console.log('- KEYCLOAK_CLIENT_ID:', process.env.KEYCLOAK_CLIENT_ID);
        
        const adminToken = await getAdminCliToken();
        console.log('✅ Admin token obtained');
        
        const usersUrl = `${process.env.KEYCLOAK_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`;
        console.log('🌐 Fetching users from:', usersUrl);
        
        const response = await axios.get(usersUrl, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            params: {
                max: 1000
            }
        });
        
        const allUsers = response.data;
        console.log(`📊 Total users found: ${allUsers.length}`);
        
        // Log beberapa user untuk debugging
        if (allUsers.length > 0) {
            console.log('📋 Sample of first 3 users:');
            allUsers.slice(0, 3).forEach((user, idx) => {
                console.log(`${idx + 1}. Username: ${user.username}`);
                console.log(`   First Name: ${user.firstName || 'N/A'}`);
                console.log(`   Last Name: ${user.lastName || 'N/A'}`);
                console.log(`   Email: ${user.email || 'N/A'}`);
                console.log(`   Enabled: ${user.enabled}`);
                console.log(`   Attributes:`, user.attributes || 'None');
            });
        }
        
        // Fungsi helper untuk mengambil atribut dengan benar
        const getAttribute = (user, attributeName) => {
            if (!user.attributes || !user.attributes[attributeName]) {
                return '';
            }
            
            const value = user.attributes[attributeName];
            
            if (Array.isArray(value)) {
                return value[0] || '';
            }
            
            if (typeof value === 'string') {
                return value;
            }
            
            return String(value) || '';
        };
        
        const formattedUsers = allUsers
            .filter(user => user.enabled !== false) // Hanya user aktif
            .map(user => {
                let nama = '';
                
                // Priority 1: firstName + lastName
                if (user.firstName || user.lastName) {
                    nama = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
                } 
                // Priority 2: attributes.nama
                else if (getAttribute(user, 'nama')) {
                    nama = getAttribute(user, 'nama');
                }
                // Priority 3: attributes.displayName
                else if (getAttribute(user, 'displayName')) {
                    nama = getAttribute(user, 'displayName');
                }
                // Priority 4: attributes.name
                else if (getAttribute(user, 'name')) {
                    nama = getAttribute(user, 'name');
                }
                // Fallback: username
                else {
                    nama = user.username || '';
                }
                
                const nip = getAttribute(user, 'nip') || getAttribute(user, 'NIP') || getAttribute(user, 'employeeId');
                const jabatan = getAttribute(user, 'jabatan') || getAttribute(user, 'Jabatan') || getAttribute(user, 'position') || getAttribute(user, 'title');
                
                return {
                    nama: nama,
                    nip: nip,
                    jabatan: jabatan,
                    username: user.username || '',
                    email: user.email || '',
                    enabled: user.enabled,
                    id: user.id
                };
            })
            .filter(user => user.nama && user.nama !== '')
            .sort((a, b) => a.nama.localeCompare(b.nama));
        
        console.log(`✅ ${formattedUsers.length} enabled users formatted for ${username}`);
        
        return res.status(200).json({
            success: true,
            message: 'Daftar semua user berhasil diambil',
            data: formattedUsers,
            count: formattedUsers.length,
            debug_info: {
                total_users: allUsers.length,
                enabled_users: formattedUsers.length,
                sample_data: formattedUsers.slice(0, 3).map(u => ({
                    nama: u.nama,
                    nip: u.nip,
                    jabatan: u.jabatan,
                    username: u.username
                }))
            }
        });
        
    } catch (error) {
        console.error('❌ Error in /users/all-simple:', error.message);
        
        // Detailed error logging
        if (error.response) {
            console.error('HTTP Response Error:');
            console.error('- Status:', error.response.status);
            console.error('- Headers:', error.response.headers);
            console.error('- Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received:', error.request);
        }
        
        return res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar user',
            error: error.message,
            suggestion: 'Periksa koneksi ke Keycloak dan kredensial admin'
        });
    }
});

// ========== KATIM MANAGEMENT ==========
router.get('/katim/list', keycloakAuth, async (req, res) => {
    const username = getUsername(req.user);
    console.log(`📋 ${username} mengakses daftar Katim`);

    try {
        const axios = require('axios');
        const { getAdminCliToken } = require('../utils/keycloakHelpers');
        const adminToken = await getAdminCliToken();
        if (!adminToken) return res.json({ success: true, data: [], count: 0 });

        // Langsung ambil user dengan role "katim" — 1 API call, cepat
        const rolesRes = await axios.get(
            `${process.env.KEYCLOAK_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/roles/katim/users`,
            { headers: { Authorization: `Bearer ${adminToken}` }, params: { max: 100 }, timeout: 15000 }
        );

        const getAttr = (u, a) => u.attributes?.[a] ? (Array.isArray(u.attributes[a]) ? u.attributes[a][0] : String(u.attributes[a])) : '';

        const katimUsers = rolesRes.data
            .filter(user => user.enabled !== false)
            .map(user => {
                const nama = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || getAttr(user, 'nama') || user.username || '';
                return {
                    id: user.id, user_id: user.id, username: user.username, email: user.email,
                    nama, nip: getAttr(user, 'nip') || '', jabatan: getAttr(user, 'jabatan') || 'Katim',
                    role: 'katim',
                };
            });

        console.log(`✅ ${katimUsers.length} Katim ditemukan`);
        res.json({ success: true, data: katimUsers, count: katimUsers.length });
    } catch (error) {
        // Fallback: jika role endpoint 404, coba cari manual dari semua user
        if (error.response?.status === 404) {
            console.log('⚠️ Role "katim" tidak ditemukan, coba fallback...');
            try {
                const axios = require('axios');
                const { getAdminCliToken } = require('../utils/keycloakHelpers');
                const adminToken = await getAdminCliToken();
                const usersRes = await axios.get(
                    `${process.env.KEYCLOAK_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`,
                    { headers: { Authorization: `Bearer ${adminToken}` }, params: { max: 200 }, timeout: 15000 }
                );
                const katimUsers = [];
                const getAttr = (u, a) => u.attributes?.[a] ? (Array.isArray(u.attributes[a]) ? u.attributes[a][0] : String(u.attributes[a])) : '';
                for (const user of usersRes.data) {
                    if (!user.enabled) continue;
                    try {
                        const rRes = await axios.get(
                            `${process.env.KEYCLOAK_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users/${user.id}/role-mappings/realm`,
                            { headers: { Authorization: `Bearer ${adminToken}` }, timeout: 5000 }
                        );
                        if (rRes.data.map(r => r.name).includes('katim')) {
                            const nama = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || getAttr(user, 'nama') || user.username;
                            katimUsers.push({ id: user.id, user_id: user.id, username: user.username, email: user.email, nama, nip: getAttr(user, 'nip') || '', jabatan: getAttr(user, 'jabatan') || 'Katim', role: 'katim' });
                        }
                    } catch (e) { /* skip */ }
                }
                return res.json({ success: true, data: katimUsers, count: katimUsers.length });
            } catch (fallbackErr) {
                return res.json({ success: true, data: [], count: 0 });
            }
        }
        console.error('Error fetch katim:', error.message);
        res.json({ success: true, data: [], count: 0, error: error.message });
    }
});

// ========== MT MANAGEMENT (role "mt") ==========
// Mirip katim/list — daftar user ber-role "mt" di Keycloak,
// dipakai pic_lab saat memilih MT tujuan pengajuan glassware semester.
router.get('/mt/list', keycloakAuth, async (req, res) => {
    console.log(`📋 ${getUsername(req.user)} mengakses daftar MT`);

    try {
        const axios = require('axios');
        const { getAdminCliToken } = require('../utils/keycloakHelpers');
        const adminToken = await getAdminCliToken();
        if (!adminToken) return res.json({ success: true, data: [], count: 0 });

        // Ambil langsung user dengan role "mt"
        const rolesRes = await axios.get(
            `${process.env.KEYCLOAK_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/roles/mt/users`,
            { headers: { Authorization: `Bearer ${adminToken}` }, params: { max: 100 }, timeout: 15000 }
        );

        const getAttr = (u, a) => u.attributes?.[a] ? (Array.isArray(u.attributes[a]) ? u.attributes[a][0] : String(u.attributes[a])) : '';

        const mtUsers = rolesRes.data
            .filter(user => user.enabled !== false)
            .map(user => {
                const nama = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || getAttr(user, 'nama') || user.username || '';
                return {
                    id: user.id, user_id: user.id, username: user.username, email: user.email,
                    nama, nip: getAttr(user, 'nip') || '', jabatan: getAttr(user, 'jabatan') || 'MT',
                    role: 'mt',
                };
            });

        console.log(`✅ ${mtUsers.length} MT ditemukan`);
        res.json({ success: true, data: mtUsers, count: mtUsers.length });
    } catch (error) {
        console.error('Error fetch mt:', error.message);
        res.json({ success: true, data: [], count: 0, error: error.message });
    }
});

module.exports = router;