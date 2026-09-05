import { badgeName } from './rewards.js';

// Small embroidered-patch shapes; each level has its own symbol and color.
export function BadgeIcon({ milestone, locked = false }) {
  const colors = {10:'#BD0032',50:'#AE622A',100:'#6F447A',250:'#287269',500:'#263E70'};
  const color = locked ? '#b7b1b3' : colors[milestone] || colors[10];
  const symbol = {
    10:<><rect x="21" y="27" width="30" height="21" rx="4"/><path d="M28 27l3-5h10l3 5"/><circle cx="36" cy="37" r="6"/></>,
    50:<path d="M36 49L23 36c-9-12 7-20 13-9 6-11 22-3 13 9Z"/>,
    100:<><path d="M36 28c-7-6-13-6-18-4v25c7-2 12-1 18 4 6-5 11-6 18-4V24c-5-2-11-2-18 4v25"/><path d="M24 32l6 2m-6 5l6 2m12-7l6-2m-6 9l6-2"/></>,
    250:<><path d="M36 19l5 12 13 5-13 5-5 13-5-13-13-5 13-5Z"/><path d="M51 19v8m-4-4h8"/></>,
    500:<><path d="M20 29l8 7 8-15 8 15 8-7-4 21H24Z"/><path d="M26 44h20"/><circle cx="20" cy="26" r="2"/><circle cx="52" cy="26" r="2"/><circle cx="36" cy="18" r="2"/></>,
  }[milestone];
  return <svg className="merit-patch" viewBox="0 0 72 82" role="img" aria-label={`${badgeName(milestone)}: ${milestone} photos${locked?', not yet earned':''}`}>
    <path d="M36 3L65 15v26c0 17-15 30-29 38C22 71 7 58 7 41V15Z" fill={color}/>
    <path d="M36 9L59 19v22c0 13-11 24-23 31C24 65 13 54 13 41V19Z" fill="none" stroke="#fff0d2" strokeWidth="1.5" strokeDasharray="2 2"/>
    <g fill="none" stroke="#fff7e6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{symbol}</g>
    <path d="M19 57h34" stroke="#fff0d2" opacity=".5"/><text x="36" y="67" fill="#fff7e6" textAnchor="middle" fontSize="10" fontWeight="900" fontFamily="system-ui,sans-serif">{milestone}</text>
  </svg>;
}
