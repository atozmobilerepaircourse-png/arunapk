import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/query-client';

export interface InsuranceSettings {
  planName: string;
  protectionPlanPrice: number;
  yearlyPrice?: number;
  monthlyPrice?: number;
  repairDiscount: number;
  status: 'active' | 'disabled';
}

const DEFAULT_SETTINGS: InsuranceSettings = {
  planName: 'Mobile Protection Plan',
  protectionPlanPrice: 50,
  yearlyPrice: 1499,
  monthlyPrice: 149,
  repairDiscount: 500,
  status: 'active',
};

let cachedSettings: InsuranceSettings | null = null;
let fetchPromise: Promise<InsuranceSettings> | null = null;

export function useInsuranceSettings() {
  const [settings, setSettings] = useState<InsuranceSettings>(cachedSettings ?? DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!cachedSettings);

  const refresh = useCallback(async () => {
    try {
      // Always clear cache and fetch fresh data on explicit refresh
      cachedSettings = null;
      fetchPromise = null;
      
      if (!fetchPromise) {
        fetchPromise = apiRequest('GET', '/api/settings/insurance')
          .then(r => r.json())
          .then(data => {
            if (data.success && data.settings) {
              cachedSettings = data.settings;
              return data.settings as InsuranceSettings;
            }
            return DEFAULT_SETTINGS;
          })
          .catch(() => DEFAULT_SETTINGS)
          .finally(() => { fetchPromise = null; });
      }
      const result = await fetchPromise;
      setSettings(result);
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!cachedSettings) {
      refresh();
    } else {
      setLoading(false);
    }
  }, []);

  return { settings, loading, refresh };
}

export function invalidateInsuranceCache() {
  cachedSettings = null;
  fetchPromise = null;
}
