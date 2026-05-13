window.api = {
  base: '',
  async get(url) {
    const res = await fetch(this.base + url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(this.base + url, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
  async del(url) {
    const res = await fetch(this.base + url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  }
};