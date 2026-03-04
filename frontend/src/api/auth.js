import client from './client';

export async function loginUser(email, password) {
  try {
    const res = await client.post('/api/auth/login', { email, password });
    return { success: true, data: res.data };
  } catch (err) {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    if (!err.response) {
      return {
        success: false,
        error: `Cannot reach server. Check your connection. (${err.message})`,
      };
    }
    if (status === 401) return { success: false, error: 'Invalid email or password' };
    if (status === 422) return { success: false, error: 'Invalid email format' };
    return { success: false, error: detail || `Server error (${status})` };
  }
}

export async function registerUser(email, password, username) {
  try {
    const res = await client.post('/api/auth/register', { email, password, username });
    return { success: true, data: res.data };
  } catch (err) {
    const detail = err?.response?.data?.detail;
    if (!err.response) {
      return {
        success: false,
        error: 'Cannot reach server. Check your connection.',
      };
    }
    return {
      success: false,
      error: detail || 'Registration failed',
    };
  }
}
