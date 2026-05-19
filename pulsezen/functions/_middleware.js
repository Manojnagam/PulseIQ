export async function onRequest(context) {
  const url = new URL(context.request.url);
  const hostname = url.hostname;

  if (url.pathname === '/' || url.pathname === '') {
    if (hostname.startsWith('dharanis.')) {
      return Response.redirect(url.origin + '/dharanis.html', 302);
    }
    if (hostname.startsWith('bksprime.') || hostname.startsWith('bks-prime.')) {
      return Response.redirect(url.origin + '/bks-prime.html', 302);
    }
  }

  return context.next();
}
