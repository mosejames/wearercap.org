import { loadEnv } from "vite";
export function booDev() {
  return {
    name: "little-boo-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      for (const [k, v] of Object.entries(env))
        if (
          /^(R2_|SUPABASE_|VITE_SUPABASE_|BOO_|OPENAI_API_KEY)/.test(k) &&
          !process.env[k]
        )
          process.env[k] = v;
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname != "/api/little-boo") return next();
        req.query = Object.fromEntries(url.searchParams);
        try {
          let size = 0;
          const chunks = [];
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 4300000) {
              res.statusCode = 413;
              res.end("{}");
              return;
            }
            chunks.push(chunk);
          }
          req.body = Buffer.concat(chunks).toString();
          res.status = (c) => {
            res.statusCode = c;
            return res;
          };
          res.json = (b) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(b));
            return res;
          };
          res.send = (b) => {
            res.end(b);
            return res;
          };
          const { default: handler } = await import("./index.js");
          await handler(req, res);
        } catch {
          res.statusCode = 503;
          res.end(
            JSON.stringify({ error: "The game is temporarily unavailable." }),
          );
        }
      });
    },
  };
}
