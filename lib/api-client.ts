const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = {
  async get(endpoint: string) {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  },
  
  async post(endpoint: string, data: any) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || `API Error: ${res.statusText}`);
    }
    return res.json();
  },
  
  async delete(endpoint: string) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { 
        'Accept': 'application/json'
      },
    });
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return res.json();
  }
};
