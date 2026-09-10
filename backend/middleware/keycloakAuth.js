const { 
    extractUserRoles, 
    isUserAdmin, 
    isUserPPK, 
    isUserKabalai, 
    isRegularUser,
    getUserId,
    getUsername 
} = require('../utils/keycloakHelpers');

// ========== KEYCLOAK AUTH MIDDLEWARE ==========
const keycloakAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized - Silakan login terlebih dahulu',
            code: 'UNAUTHORIZED'
        });
    }
    
    // 1. Ekstrak roles dari berbagai kemungkinan lokasi di Keycloak
    req.user.extractedRoles = extractUserRoles(req.user);
    
    // 2. Tambahkan ke req.user.role untuk kompatibilitas
    if (req.user.extractedRoles && req.user.extractedRoles.length > 0) {
        req.user.role = req.user.extractedRoles;
    }
    
    // 3. Tambahkan user_id jika belum ada
    if (!req.user.user_id && req.user.id) {
        req.user.user_id = req.user.id;
    }
    if (!req.user.user_id && req.user.sub) {
        req.user.user_id = req.user.sub;
    }
    
    // 4. Identifikasi role khusus untuk akses data
    req.user.isAdmin = isUserAdmin(req.user);
    req.user.isPPK = isUserPPK(req.user);
    req.user.isKabalai = isUserKabalai(req.user);
    req.user.isRegularUser = isRegularUser(req.user);
    
    console.log(`🔐 User ${getUsername(req.user)} mengakses ${req.method} ${req.path}`, {
        roles: req.user.extractedRoles,
        user_id: req.user.user_id,
        isAdmin: req.user.isAdmin,
        isPPK: req.user.isPPK,
        isKabalai: req.user.isKabalai,
        isRegularUser: req.user.isRegularUser
    });
    
    next();
};

/**
 * Middleware untuk mengecek role user (case-insensitive)
 * @param {string[]} allowedRoles - Daftar role yang diizinkan (lowercase)
 */
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRoles = req.user?.extractedRoles || req.user?.role || req.user?.roles || [];
        const userRolesLower = userRoles.map(r => r.toLowerCase());
        const allowedLower = allowedRoles.map(r => r.toLowerCase());
        
        const hasAccess = allowedLower.some(role => userRolesLower.includes(role));
        
        if (!hasAccess) {
            console.log(`⛔ Access denied. Required roles: ${allowedRoles.join(', ')}. User roles: ${userRolesLower.join(', ')}`);
            return res.status(403).json({
                success: false,
                message: `Akses ditolak. Required roles: ${allowedRoles.join(', ')}`,
                code: 'FORBIDDEN'
            });
        }
        
        next();
    };
};

module.exports = {
    keycloakAuth,
    checkRole,
    getUserId,
    getUsername
};