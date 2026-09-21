// pages/_app.js
import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import ThemeRegistry from '../components/ThemeRegistry';
// Pasang interceptor autentikasi global (401/403 -> redirect ke /login)
import '../utils/authInterceptor';

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <ThemeRegistry>
        <Component {...pageProps} />
      </ThemeRegistry>
    </SessionProvider>
  );
}

export default MyApp;