import React from 'react';
import {ArrowRight} from 'lucide-react';
export default function MobileSiteChoice() {
  const mobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent || '')
    || (/Macintosh/i.test(navigator.userAgent || '') && navigator.maxTouchPoints>1)
    || !!navigator.userAgentData?.mobile;
  if(!mobile) return null;
  return <aside className="mobile-site-choice" aria-label="Website view"><span>You’re viewing the full website.</span><a href="/?view=app">Use the family hub <ArrowRight size={14} aria-hidden="true"/></a></aside>;
}
