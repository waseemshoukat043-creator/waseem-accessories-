
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase credentials missing. Please check your .env file.'
  )
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)

// Test Supabase connection using the existing products table
export async function testSupabaseConnection() {
  try {
    const { error } = await supabase
      .from('products')
      .select('id')
      .limit(1)

    if (error) {
      console.error('Supabase connection error:', error.message)

      return {
        connected: false,
        message: error.message
      }
    }

    return {
      connected: true,
      message: 'Supabase connected successfully!'
    }
  } catch (error) {
    console.error('Supabase connection failed:', error)

    return {
      connected: false,
      message: error.message
    }
  }
}
