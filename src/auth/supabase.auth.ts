import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for privileged operations (e.g. deleting users)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export const deleteSupabaseUser = async (userId: string): Promise<void> => {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('Error deleting Supabase user:', error);
    throw error;
  }
};

export interface SupabaseUser {
  id: string;
  email?: string;
  username?: string;
  aud: string;
  exp: number;
}

export const verifySupabaseToken = async (token: string): Promise<SupabaseUser | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('Error verifying token:', error);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || user.email?.split('@')[0],
      aud: user.aud,
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour from now
    };
  } catch (error) {
    console.error('Error verifying Supabase token:', error);
    return null;
  }
};