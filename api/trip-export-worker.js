import {QueueClient} from '@vercel/queue';
import {processExport} from '../server/trip-engine/exports.js';
const queue=new QueueClient({region:'iad1'});
export const config={maxDuration:300};
export default queue.handleNodeCallback(processExport,{visibilityTimeoutSeconds:300,retry:(_error,metadata)=>metadata.deliveryCount>6?{acknowledge:true}:{afterSeconds:Math.min(900,30*Math.max(1,metadata.deliveryCount))}});
