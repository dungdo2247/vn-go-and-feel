import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { onRequestPost as planner } from '../functions/api/planner.ts';
import { onRequestPost as journal } from '../functions/api/journal.ts';
import { onRequestPost as recommendation } from '../functions/api/recommend-destination.ts';
import { onRequest } from '../functions/api/_middleware.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function context(body: unknown = {}, key = 'test-secret') {
  return {
    request: new Request('https://example.pages.dev/api/planner', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    env: { GEMINI_API_KEY: key },
  };
}

function gemini(text: string) {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

test('planner preserves structured output and keeps the secret in an upstream header', async () => {
  const itinerary = { title: 'Đà Lạt', summary: 'Chuyến đi', itinerary: [{ day: 1, activities: [] }] };
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith('gemini-3.8-flash:generateContent'));
    assert.ok(!String(url).includes('test-secret'));
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), 'test-secret');
    const payload = JSON.parse(String(init?.body));
    assert.ok(payload.contents[0].parts[0].text.includes('Đà Lạt'));
    assert.ok(payload.systemInstruction.parts[0].text);
    assert.equal(payload.generationConfig.responseMimeType, 'application/json');
    assert.equal(payload.generationConfig.responseSchema.type, 'OBJECT');
    return gemini(JSON.stringify(itinerary));
  };
  const response = await planner(context({ destination: 'Đà Lạt' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { success: true, data: itinerary });
});

test('journal sends image data without data URL prefix and preserves UI fields', async () => {
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(String(init?.body));
    assert.deepEqual(payload.contents[0].parts[0], { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } });
    return gemini('🖋️: Một ngày đẹp\n📖: Bình yên ở Đà Lạt.\n🏷️: #DaLat #Travel');
  };
  const response = await journal(context({ imageBase64: 'data:image/png;base64,aGVsbG8=', mimeType: 'image/png' }));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.success, true);
  assert.equal(data.data.caption, 'Một ngày đẹp');
  assert.equal(data.data.journal, 'Bình yên ở Đà Lạt.');
  assert.deepEqual(data.data.hashtags, ['#DaLat', '#Travel']);
});

test('recommendation preserves parsed destination and experiences', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.ok(JSON.parse(String(init?.body)).contents[0].parts[0].text.includes('Đà Nẵng'));
    return gemini('🔍: Thích thiên nhiên\n🎯: Ninh Bình\n💡: Non nước hữu tình\n🎒: \n- Đi thuyền Tràng An\n- Thăm Hang Múa\n- Ăn cơm cháy');
  };
  const response = await recommendation(context({ visitedProvinces: ['Đà Nẵng'] }));
  const data = await response.json();
  assert.equal(data.data.nextDestination, 'Ninh Bình');
  assert.equal(data.data.experiences.length, 3);
});

test('missing secret and invalid JSON fail before calling Gemini', async () => {
  globalThis.fetch = async () => { throw new Error('Must not call Gemini'); };
  assert.equal((await planner(context({}, ''))).status, 503);
  const bad = context();
  bad.request = new Request(bad.request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal((await planner(bad)).status, 400);
  assert.equal((await journal(context({ imageBase64: 42 }))).status, 400);
  assert.equal((await recommendation(context({ visitedProvinces: [42] }))).status, 400);
  assert.equal((await planner(context(null))).status, 400);
});

test('transient failures retry then move to the fallback model', async () => {
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (urls.length <= 2) return Response.json({ error: 'busy' }, { status: 503 });
    return gemini(JSON.stringify({ title: 'Fallback', summary: 'OK', itinerary: [] }));
  };
  const response = await planner(context());
  assert.equal(response.status, 200);
  assert.equal(urls.length, 3);
  assert.ok(urls[2].includes('gemini-3.1-flash-lite'));
});

test('upstream errors never expose secrets or internal error bodies', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: 'test-secret: private detail' }, { status: 403 }); };
  const response = await planner(context());
  assert.equal(response.status, 502);
  assert.equal(calls, 1);
  assert.ok(!(await response.text()).includes('test-secret'));
});

test('API middleware returns JSON for unsupported methods and unknown routes', async () => {
  const next = async () => Response.json({ success: true });
  const method = await onRequest({ request: new Request('https://example.pages.dev/api/planner'), next });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'POST');
  const unknown = await onRequest({ request: new Request('https://example.pages.dev/api/missing', { method: 'POST' }), next });
  assert.equal(unknown.status, 404);
  const supported = await onRequest({ request: context().request, next });
  assert.equal(supported.status, 200);
});
