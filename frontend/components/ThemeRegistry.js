// components/ThemeRegistry.js
// Sinkronisasi MUI theme dengan dark mode Tailwind (class "dark" di <html>)

import { useState, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

export default function ThemeRegistry({ children }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Baca theme dari localStorage / class di <html>
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setDarkMode(isDark);
    };

    checkTheme();

    // Observer perubahan class di <html> (dari DashboardLayout toggle)
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          ...(darkMode && {
            background: {
              default: '#1e1e2e',
              paper: '#2a2a3d',
            },
            text: {
              primary: '#e0e0e0',
              secondary: '#a0a0b0',
            },
            divider: 'rgba(255,255,255,0.12)',
          }),
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
          MuiTableHead: {
            styleOverrides: {
              root: {
                '& .MuiTableCell-head': {
                  fontWeight: 600,
                },
              },
            },
          },
        },
      }),
    [darkMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
