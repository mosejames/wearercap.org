import { QueueClient } from "@vercel/queue";
import { processMessage } from "../server/london-stories/worker.js";
import {processExport} from '../server/nyc-export/core.js';
const queue = new QueueClient({ region: "iad1" });
export const config = { maxDuration: 300 };
export default queue.handleNodeCallback((message,metadata)=>message.type?.startsWith('nyc-export')?processExport(message):processMessage(message,metadata), {
  visibilityTimeoutSeconds: 300,
  retry: (error, metadata) => {
    (error.message === "Another import is active"
      ? console.info
      : console.error)("London import retry", {
      delivery: metadata.deliveryCount,
      error: error.message,
    });
    return {
      afterSeconds: Math.min(900, 30 * Math.max(1, metadata.deliveryCount)),
    };
  },
});
