export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    if (url.pathname === '/test-worker') {
      return new Response('Worker running! hostname: ' + hostname + ' | path: ' + url.pathname, { status: 200 });
    }

    if (url.pathname === '/' || url.pathname === '') {
      if (hostname.startsWith('dharanis.')) {
        return Response.redirect('https://dharanis.pulsezen.in/dharanis.html', 302);
      }
      if (hostname.startsWith('bksprime.') || hostname.startsWith('bks-prime.')) {
        return Response.redirect('https://bksprime.pulsezen.in/bks-prime.html', 302);
      }
    }

    // For all other requests (images, CSS, JS etc.) fetch from main workers URL
    const assetUrl = new URL(request.url);
    assetUrl.hostname = 'pulsezen.nagam-kumar.workers.dev';
    return env.ASSETS.fetch(assetUrl.toString());
  }
};
