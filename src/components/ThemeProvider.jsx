import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'warm', setTheme: () => {} });

export function ThemeProvider({ children, defaultTheme = 'warm' }) {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('warm', 'frost');
    root.classList.add(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
