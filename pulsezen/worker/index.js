export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    if (url.pathname === '/' || url.pathname === '') {
      if (hostname.startsWith('dharanis.')) {
        return Response.redirect('https://dharanis.pulsezen.in/dharanis.html', 302);
      }
      if (hostname.startsWith('bksprime.') || hostname.startsWith('bks-prime.')) {
        return Response.redirect('https://bksprime.pulsezen.in/bks-prime.html', 302);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
