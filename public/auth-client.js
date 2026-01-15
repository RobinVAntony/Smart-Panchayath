const API_BASE = 'http://localhost:8181/api';

console.log('API Base URL:', API_BASE);

async function authFetch(path, options = {}) {
  // Remove any leading slash issues
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  const url = API_BASE + cleanPath;
  
  console.log('🔗 authFetch called for:', url);
  
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('No token found, redirecting to login');
    window.location.href = 'login.html';
    return null;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    console.log('Response status:', res.status, res.statusText);

    if (res.status === 401 || res.status === 403) {
      console.warn('Token expired or invalid, redirecting to login');
      localStorage.removeItem('token');
      window.location.href = 'login.html';
      return null;
    }

    // Handle HTML responses (like 404 pages)
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.error('Received HTML instead of JSON for:', url);
      const text = await res.text();
      console.error('HTML response:', text.substring(0, 500));
      throw new Error(`Server returned HTML (likely 404) for ${url}`);
    }

    return res;
  } catch (error) {
    console.error('Network error in authFetch:', error);
    throw error;
  }
}