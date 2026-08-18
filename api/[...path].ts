import app from "../server.js";

// Vercel maps this catch-all function to every /api/* endpoint. The Express
// app keeps the current REST API contract unchanged for the React client.
export default app;
