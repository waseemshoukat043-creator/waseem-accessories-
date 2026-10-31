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
  supabaseKey
)

// Test Supabase connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('connection_test')
      .select('*')
      .limit(1)

    // Table not found means the API was reached,
    // but the test table has not been created yet.
    if (error && error.code === 'PGRST205') {
      return {
        connected: true,
        message: 'Supabase API connected. Database test table not created yet.'
      }
    }

    if (error) {
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
    return {
      connected: false,
      message: error.message
    }
  }
}