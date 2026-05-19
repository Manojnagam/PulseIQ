export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    if (url.pathname === '/' || url.pathname === '') {
      if (hostname.startsWith('dharanis.')) {
        url.pathname = '/dharanis.html';
        return env.ASSETS.fetch(url.toString());
      }
      if (hostname.startsWith('bksprime.') || hostname.startsWith('bks-prime.')) {
        url.pathname = '/bks-prime.html';
        return env.ASSETS.fetch(url.toString());
      }
    }

    return env.ASSETS.fetch(request);
  }
};
