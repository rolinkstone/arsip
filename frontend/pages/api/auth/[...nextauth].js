// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

// ============================================================
// Cookie sesi diberi PREFIX khusus aplikasi ini (ecipar).
// TANPA prefix ini, semua app NextAuth yang berjalan di host yang
// sama (mis. Talawang & ECIPAR sama-sama di localhost) memakai nama
// cookie default `next-auth.session-token` yang SAMA.
// Karena cookie TIDAK memisahkan port, login di app A akan menimpa
// cookie milik app B -> sesi app B tidak bisa didekripsi (secret
// berbeda) -> app B terlihat LOGOUT. Prefix membuat tiap app punya
// cookie sendiri sehingga bisa login bersamaan tanpa saling logout.
// ============================================================
const secureCookies = (process.env.NEXTAUTH_URL || '').startsWith('https://');
const ns = (name) => `ecipar.${name}`;

export const authOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,

      authorization: {
        params: {
          scope: "openid profile email roles",
        },
      },

      profile(profile) {
        const realmRoles = profile.realm_access?.roles || [];
        const recognizedRoles = ['admin', 'superadmin', 'ppk', 'pic_ruangan', 'pic', 'kabag_tu', 'kabalai', 'bendahara', 'pic_persediaan', 'pic_gudang', 'pic_lab', 'katim', 'mt', 'admin_arsiparis'];
        const roles = realmRoles.filter(r => recognizedRoles.includes(r));

        // Role yang DITAMPILKAN di aplikasi Persuratan ini:
        //   default "user" — role lain (ppk/pic/kabag/kabalai/dll.) berasal dari
        //   sistem lain di realm yang sama dan TIDAK dipakai sebagai label di sini.
        //   Hanya katim & admin_arsiparis yang menimpa (prioritas sama seperti beranda:
        //   katim > admin_arsiparis > user).
        let primaryRole = 'user';
        if (roles.includes('katim')) primaryRole = 'katim';
        else if (roles.includes('admin_arsiparis')) primaryRole = 'admin_arsiparis';

        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          role: primaryRole,
          roles: roles,
          username: profile.preferred_username,
        };
      },
    }),
  ],

  // Nama cookie unik per aplikasi (hindari bentrok dgn app NextAuth lain).
  cookies: {
    sessionToken: {
      name: ns('next-auth.session-token'),
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookies },
    },
    callbackUrl: {
      name: ns('next-auth.callback-url'),
      options: { sameSite: 'lax', path: '/', secure: secureCookies },
    },
    csrfToken: {
      name: ns('next-auth.csrf-token'),
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookies },
    },
    pkceCodeVerifier: {
      name: ns('next-auth.pkce.code_verifier'),
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookies },
    },
    state: {
      name: ns('next-auth.state'),
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookies },
    },
    nonce: {
      name: ns('next-auth.nonce'),
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: secureCookies },
    },
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.roles = user.roles;
        token.username = user.username;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        role: token.role,
        roles: token.roles || [],
        username: token.username,
      };

      const userRoles = token.roles || [];
      session.user.isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin');
      session.user.isPICRuangan = userRoles.includes('pic_ruangan') || userRoles.includes('pic');
      session.user.isPPK = userRoles.includes('ppk');
      session.user.isKabagTU = userRoles.includes('kabag_tu');
      session.user.isKabalai = userRoles.includes('kabalai');
      session.user.isBendahara = userRoles.includes('bendahara');
      session.user.isPicLab = userRoles.includes('pic_lab');
      session.user.isPicGudang = userRoles.includes('pic_gudang');
      session.user.isPicPersediaan = userRoles.includes('pic_persediaan');
      session.user.isKatim = userRoles.includes('katim');
      session.user.isMt = userRoles.includes('mt');
      session.user.isAdminArsiparis = userRoles.includes('admin_arsiparis');
      // Penanda peran 'user' (boleh ikut dinas & membuat Surat Tugas sendiri).
      // Dipakai agar akun BERPERAN GANDA — mis. user + admin_arsiparis — tetap
      // bisa membuat ST; sebelumnya tombolnya hilang karena aturannya hanya
      // "bukan katim & bukan admin arsiparis".
      session.user.isUser = userRoles.includes('user');

      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      session.refreshToken = token.refreshToken;
      session.clientId = process.env.KEYCLOAK_CLIENT_ID || 'local-surat';
      session.expires = token.expiresAt
        ? new Date(token.expiresAt * 1000).toISOString()
        : null;

      return session;
    },
  },

  events: {
    async signOut({ token }) {
      // Hancurkan Keycloak SSO session saat NextAuth logout
      if (token?.idToken) {
        const issuer = process.env.KEYCLOAK_ISSUER;
        const clientId = process.env.KEYCLOAK_CLIENT_ID || 'local-surat';
        const logoutUrl = `${issuer}/protocol/openid-connect/logout?id_token_hint=${token.idToken}&post_logout_redirect_uri=${process.env.NEXTAUTH_URL}/login&client_id=${clientId}`;
        try {
          await fetch(logoutUrl);
        } catch (error) {
          console.error('❌ Keycloak SSO logout error:', error);
        }
      }
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 4 * 60 * 60,
  },

  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

export default NextAuth(authOptions);