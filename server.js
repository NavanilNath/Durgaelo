const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg"
};

http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost:3000");

  if (url.pathname === "/api/video-metadata") {
    const videoId = url.searchParams.get("id") || "";
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Invalid video ID" }));
      return;
    }

    try {
      const oembedUrl = "https://www.youtube.com/oembed?url=" + encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`) + "&format=json";
      const metadataResponse = await fetch(oembedUrl, {
        headers: { "User-Agent": "Durga-Puja-Songs/1.0", "Accept-Language": "en" },
        signal: AbortSignal.timeout(8000)
      });
      if (!metadataResponse.ok) throw new Error(`YouTube returned ${metadataResponse.status}`);
      const metadata = await metadataResponse.json();
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ title: metadata.title, author_name: metadata.author_name }));
    } catch (error) {
      response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Unable to fetch YouTube metadata" }));
    }
    return;
  }

  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(root, `.${requestPath}`);

  if (!filePath.startsWith(root + path.sep) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store, max-age=0"
  });
  fs.createReadStream(filePath).pipe(response);
}).listen(3000, () => {
  console.log("Durga Puja Songs is running at http://localhost:3000");
});
