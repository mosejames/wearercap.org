import {QueueClient} from '@vercel/queue';
import {processExport} from '../server/nyc-export/core.js';
const queue=new QueueClient({region:'iad1'});
export const config={maxDuration:300};
export default queue.handleNodeCallback(processExport,{visibilityTimeoutSeconds:300,retry:(error,metadata)=>({afterSeconds:Math.min(900,30*Math.max(1,metadata.deliveryCount))})});
