const http = require("http");
const https = require("https");

function targetFor(req, targetBaseUrl) {
  return new URL(req.originalUrl || req.url, `${targetBaseUrl.replace(/\/$/, "")}/`);
}

function forwardedHeaders(req, target) {
  return {
    ...req.headers,
    host: target.host,
    "x-forwarded-for": req.socket.remoteAddress || "",
    "x-forwarded-host": req.headers.host || "",
    "x-forwarded-proto": req.socket.encrypted ? "https" : "http"
  };
}

function clientFor(target) {
  return target.protocol === "https:" ? https : http;
}

function proxySocketHttp(req, res, targetBaseUrl) {
  const target = targetFor(req, targetBaseUrl);
  const upstream = clientFor(target).request(target, {
    method: req.method,
    headers: forwardedHeaders(req, target)
  }, (upstreamResponse) => {
    res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(res);
  });
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: false, message: "Real-time bidding service unavailable" }));
  });
  req.pipe(upstream);
}

function proxySocketUpgrade(req, clientSocket, head, targetBaseUrl) {
  const target = targetFor(req, targetBaseUrl);
  const upstreamRequest = clientFor(target).request(target, {
    method: req.method,
    headers: forwardedHeaders(req, target)
  });

  upstreamRequest.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    clientSocket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`);
    for (let index = 0; index < response.rawHeaders.length; index += 2) {
      clientSocket.write(`${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}\r\n`);
    }
    clientSocket.write("\r\n");
    if (upstreamHead.length) clientSocket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(clientSocket).pipe(upstreamSocket);
  });

  upstreamRequest.on("response", (response) => {
    clientSocket.end(`HTTP/1.1 ${response.statusCode || 502} ${response.statusMessage || "Bad Gateway"}\r\nConnection: close\r\n\r\n`);
  });
  upstreamRequest.on("error", () => clientSocket.destroy());
  upstreamRequest.end();
}

module.exports = { proxySocketHttp, proxySocketUpgrade, targetFor, forwardedHeaders };
