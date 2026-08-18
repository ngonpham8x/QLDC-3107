import { createRequire } from "node:module";

// Vercel creates an isolated bundle for each file in /api.  Load the Express
// application from the build artifact that is explicitly included alongside
// this function, rather than importing a source file outside /api.
const require = createRequire(import.meta.url);
const serverModule = require("./_server.cjs");
const app = serverModule.default || serverModule;

// vercel.json rewrites /api/* to this single Function and passes the original
// route in `path`. Restore it so the existing Express routes stay unchanged.
export default (req: any, res: any) => {
  const url = new URL(req.url || "/api", "http://localhost");
  const path = url.searchParams.get("path");
  if (path) {
    url.searchParams.delete("path");
    const query = url.searchParams.toString();
    req.url = `/api/${path}${query ? `?${query}` : ""}`;
  }
  return app(req, res);
};
