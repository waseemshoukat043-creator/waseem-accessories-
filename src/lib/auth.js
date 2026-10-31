
import { supabase } from './supabase'

// Customer Signup
export async function signUpUser({ fullName, email, password, phone }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone
      }
    }
  })

  if (error) throw error

  return data
}

// Customer Login
export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error

  return data
}

// Logout
export async function logoutUser() {
  const { error } = await supabase.auth.signOut()

  if (error) throw error
}

// Get Current User
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) throw error

  return data.user
}

// Forgot Password
export async function forgotPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: `${window.location.origin}/reset-password`
    }
  )

  if (error) throw error

  return data
}
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) throw error

  return data
}