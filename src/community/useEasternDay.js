import {useEffect,useState} from 'react';
import {easternToday} from './calendar.js';
export function useEasternDay() {
  const [today,setToday]=useState(easternToday);
  useEffect(()=>{
    const update=()=>setToday(easternToday());
    const interval=window.setInterval(update,60000);
    window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return()=>{window.clearInterval(interval);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[]);
  return today;
}
