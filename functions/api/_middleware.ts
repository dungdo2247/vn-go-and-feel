// Keep unknown API routes and unsupported methods from falling back to index.html.
export const onRequest = async ({ request, next }: { request: Request; next: () => Promise<Response> }) => {
  const pathname = new URL(request.url).pathname.replace(/\/$/, '');
  if (!['/api/planner', '/api/journal', '/api/recommend-destination'].includes(pathname)) {
    return Response.json({ success: false, error: 'API không tồn tại.' }, { status: 404 });
  }
  if (request.method !== 'POST') {
    return Response.json({ success: false, error: 'Chỉ hỗ trợ POST.' }, { status: 405, headers: { Allow: 'POST' } });
  }
  return next();
};
