import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const FALLBACK = {
  demo_mode: false,
  ai: { engine: 'built-in', enabled: true },
  announcements: [],
  itinerary_tags: [],
  travel_styles: [],
  reactions: ['❤️', '😍', '😂', '🔥', '🙌', '😮'],
  zine_themes: ['marigold', 'monsoon', 'chai', 'indigo', 'mehendi'],
  expense_categories: ['stay', 'transport', 'food', 'activities', 'shopping', 'other'],
  upi_apps: ['gpay', 'phonepe', 'paytm', 'bhim'],
  plus_price_monthly: 199,
  free_concierge_daily: 15,
  destinations: [],
};

const Ctx = createContext(FALLBACK);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(FALLBACK);
  useEffect(() => {
    api.get('/config').then((c) => setConfig({ ...FALLBACK, ...c })).catch(() => {});
  }, []);
  return <Ctx.Provider value={config}>{children}</Ctx.Provider>;
}

export const useConfig = () => useContext(Ctx);
