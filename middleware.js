export const config = { matcher: ["/", "/index.html"] };

export default async function middleware(request) {
  const res = await fetch(request);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;
  let html = await res.text();
  if (html.includes("/js/dir-banners.js")) return res;
  html = html.replace("</body>", '<script src="/js/dir-banners.js" defer></script></body>');
  return new Response(html, {
    status: res.status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
