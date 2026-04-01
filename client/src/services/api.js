class APIClient {
  constructor() {
    this.baseURL = '';
  }

  async request(method, path, body = null) {
    const token = localStorage.getItem('vhub_token');
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(this.baseURL + path, options);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('vhub_token');
          localStorage.removeItem('vhub_user');
          window.location.href = '/';
        }
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${method} ${path}]:`, error);
      throw error;
    }
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  put(path, body) {
    return this.request('PUT', path, body);
  }

  delete(path) {
    return this.request('DELETE', path);
  }
}

export const api = new APIClient();
