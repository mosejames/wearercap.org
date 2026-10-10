import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "feedback-dev-routes",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (/^\/share\/[0-9a-f]{64}(?:\?.*)?$/.test(req.url || ""))
            req.url = "/capsule-share/index.html";
          if (/^\/feedback\/(?!.*\.)[^?]*(?:\?.*)?$/.test(req.url || ""))
            req.url = "/feedback/index.html";
          next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        uniformplaybook: resolve(__dirname, 'uniform-playbook/index.html'),
      raffleplaybook: resolve(__dirname, 'raffle-playbook/index.html'),
      playbook: resolve(__dirname, "committee-playbook/index.html"),
        housepoint: resolve(__dirname, "house-point/index.html"),
        capsuleshare: resolve(__dirname, "capsule-share/index.html"),
        feedback: resolve(__dirname, "feedback/index.html"),
        tonight: resolve(__dirname, "karaoke/tonight/index.html"),
        now: resolve(__dirname, "now/index.html"),
        septembernewsletter: resolve(
          __dirname,
          "newsletter/september-20/index.html",
        ),
        karaokevideo: resolve(__dirname, "this-is-how-we-do-it/index.html"),
        directory: resolve(__dirname, "directory/index.html"),
        checkrequests: resolve(__dirname, "check-requests/index.html"),
        carpool: resolve(__dirname, "carpool/index.html"),
        recap: resolve(__dirname, "rcap-recap/index.html"),
        exchange: resolve(__dirname, "uniform-exchange/index.html"),
        wishiknew: resolve(__dirname, "wish-i-knew/index.html"),
        wishiknewread: resolve(__dirname, "wish-i-knew/read/index.html"),
        londonready: resolve(__dirname, '2028-london-ready/index.html'),
        londonvault: resolve(__dirname, '2028-london/index.html'),
        amivault: resolve(__dirname, "ami-vault/index.html"),
        rcapvault: resolve(__dirname, "rcap-capsule/index.html"),
        m3vault: resolve(__dirname, "m3-vault/index.html"),
        committeeinterest: resolve(__dirname, "committee-interest/index.html"),
        board: resolve(__dirname, "board/index.html"),
        rsvp: resolve(__dirname, "rsvp/index.html"),
        parentplaylist: resolve(__dirname, "karaoke/playlist/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
