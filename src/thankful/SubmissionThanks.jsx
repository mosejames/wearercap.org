import React from 'react';
import { Instagram } from 'lucide-react';

export default function SubmissionThanks() {
  return <div className="submission-thanks">
    <h3>Thank you for sharing your gratitude!</h3>
    <p>Follow @rcaparents and look out for Thankful at RCA posts throughout the Thanksgiving holiday.</p>
    <a className="button" href="https://www.instagram.com/rcaparents/" target="_blank" rel="noopener noreferrer">
      <Instagram size={17} aria-hidden="true"/> Follow @rcaparents
    </a>
  </div>;
}
