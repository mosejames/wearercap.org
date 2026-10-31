import { defineConfig } from "vite";
import {booDev} from './server/boo/dev.js';
import react from "@vitejs/plugin-react";
import {tripStudioDev} from "./server/trip-studio/dev.js";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    booDev(),
    tripStudioDev(),
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
        littleboo: resolve(__dirname, "little-boo/index.html"),
        tripstudio: resolve(__dirname, "trip-studio/index.html"),
        tripengine: resolve(__dirname, "trip-vault/index.html"),
        raffleInformation: resolve(__dirname, "raffle/2026/information/index.html"),
        events2026: resolve(__dirname, "events/2026/index.html"),
        trunk2026: resolve(__dirname, "events/2026/trunk-or-treat/index.html"),
        raffle2026: resolve(__dirname, "events/2026/fall-raffle/index.html"),
        raffleCommittee2026: resolve(__dirname, "events/2026/fall-raffle/committee-lookup/index.html"),
        raffleResults2026: resolve(__dirname, "events/2026/fall-raffle/results/index.html"),
        travel2026: resolve(__dirname, "events/2026/student-adventures/index.html"),
        karaokecloseout: resolve(__dirname, "karaoke/closeout/index.html"),
        uniformplaybook: resolve(__dirname, 'uniform-playbook/index.html'),
      raffleplaybook: resolve(__dirname, 'raffle-playbook/index.html'),
      playbook: resolve(__dirname, "committee-playbook/index.html"),
        housepoint: resolve(__dirname, "house-point/index.html"),
        capsuleshare: resolve(__dirname, "capsule-share/index.html"),
        feedback: resolve(__dirname, "feedback/index.html"),
        trunkfeedback: resolve(__dirname, "feedback/trunk-or-treat-2026/index.html"),
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
        londonwelcome: resolve(__dirname, '2028-london-welcome/index.html'),
        londonready: resolve(__dirname, '2028-london-ready/index.html'),
        nycsendoff: resolve(__dirname, 'nyc-sendoff/index.html'),
        nycvault: resolve(__dirname, 'nyc-vault/index.html'),
        londonvault: resolve(__dirname, '2028-london/index.html'),
        amivault: resolve(__dirname, "ami-vault/index.html"),
        rcapvault: resolve(__dirname, "rcap-capsule/index.html"),
        m3vault: resolve(__dirname, "m3-vault/index.html"),
        committeeinterest: resolve(__dirname, "committee-interest/index.html"),
        board: resolve(__dirname, "board/index.html"),
        rsvp: resolve(__dirname, "rsvp/index.html"),
        parentplaylist: resolve(__dirname, "karaoke/playlist/index.html"),
        newsletterintake: resolve(__dirname, "newsletter/submit/index.html"),
        familyTripStories: resolve(__dirname, "family-trip-stories/index.html"),
        newsletterbuilder: resolve(__dirname, "newsletter/builder/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
