import { raffleTimeLeft, SECOND_RAFFLE_DEADLINE } from './raffleCountdown.js';
const panel = document.querySelector('[data-raffle-countdown]');
if (panel) {
  const update = () => {
    const left = raffleTimeLeft(Date.now(), SECOND_RAFFLE_DEADLINE);
    panel.querySelector('[data-countdown-clock]').hidden = left.closed;
    panel.querySelector('[data-countdown-status]').hidden = !left.closed;
    for (const unit of ['days', 'hours', 'minutes', 'seconds']) {
      panel.querySelector(`[data-unit="${unit}"]`).textContent = String(left[unit]).padStart(2, '0');
    }
  };
  update();
  setInterval(update, 1000);
  document.addEventListener('visibilitychange', update);
}
