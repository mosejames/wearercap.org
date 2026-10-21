export const GROUPS=[['A','Group A'],['AA','Group AA'],['both','Both groups']];
export const validGroup=value=>GROUPS.some(([key])=>key===value);
export const groupLabel=value=>GROUPS.find(([key])=>key===value)?.[1]||'Not assigned';
export const matchesGroup=(photo,group)=>!group||!photo.group||photo.group==='both'||photo.group===group;
export function initialGroupFilter(){const value=new URLSearchParams(window.location.search).get('group');return value==='A'||value==='AA'?value:'';}
export function rememberedUploadGroup(){try{const value=window.localStorage.getItem('nyc-upload-group');return validGroup(value)?value:'';}catch{return '';}}
export function rememberUploadGroup(value){try{window.localStorage.setItem('nyc-upload-group',value);}catch{/* Uploading works when storage is unavailable. */}}
