export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    if (url.pathname === '/' || url.pathname === '') {
      if (hostname.startsWith('dharanis.')) {
        const newUrl = new URL(request.url);
        newUrl.pathname = '/dharanis.html';
        return env.ASSETS.fetch(new Request(newUrl.toString(), request));
      }
      if (hostname.startsWith('bksprime.') || hostname.startsWith('bks-prime.')) {
        const newUrl = new URL(request.url);
        newUrl.pathname = '/bks-prime.html';
        return env.ASSETS.fetch(new Request(newUrl.toString(), request));
      }
    }

    return env.ASSETS.fetch(request);
  }
};
