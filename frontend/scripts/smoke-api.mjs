const apiUrl = (process.env.BIDX_API_URL || "http://localhost:4000/api/v1").replace(/\/$/, "");
const gatewayUrl = apiUrl.replace(/\/api\/v1$/, "");

const checks = [
  ["gateway health", `${gatewayUrl}/health`],
  ["auction catalog", `${apiUrl}/auctions?page=1&limit=1`],
  ["search", `${apiUrl}/search?q=auction&page=1&limit=1`],
];

let failed = false;
for (const [name, url] of checks) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

if (failed) process.exitCode = 1;
