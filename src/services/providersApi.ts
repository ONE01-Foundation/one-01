import { supabaseService } from './supabaseService';

export interface ProviderRecord {
  id: string;
  name: string;
  type: string;
  location: string;
  priceRange: string;
  rating: number;
  availabilityText: string;
  metadata: Record<string, unknown> | null;
}

function ensureClient() {
  if (!supabaseService.getClient()) {
    supabaseService.initialize();
  }
  const client = supabaseService.getClient();
  if (!client) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return client;
}

export const providersApi = {
  async listProvidersByType(type: string, location?: string): Promise<ProviderRecord[]> {
    const client = ensureClient();
    let query = client.from('providers').select('*').eq('type', type);

    if (location) {
      query = query.eq('location', location);
    }

    query = query.order('rating', { ascending: false });

    const typedQuery = query.returns<ProviderRecord[]>();
    const { data, error } = await typedQuery;
    if (error) throw error;
    return data ?? [];
  },
};
