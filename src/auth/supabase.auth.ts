import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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