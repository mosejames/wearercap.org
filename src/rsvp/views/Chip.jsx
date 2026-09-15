import { houseColor, houseInk, initials } from '../model.js';

/* The 44px circle used on the wall and in the thread: the parent's photo, or
   their initials on their house colour. */
export function Avatar({ person, size = 44 }) {
  const style = { width: size, height: size, background: houseColor(person.house), color: houseInk(person.house) };
  return (
    <span className="rv-avatar" style={style} aria-hidden="true">
      {person.photo_url ? <img src={person.photo_url} alt="" loading="lazy" /> : initials(person.wall_name)}
    </span>
  );
}

export function Chip({ person, index = 0, you = false }) {
  return (
    <li className={`rv-chip${you ? ' is-you' : ''}`} style={{ animationDelay: `${Math.min(index, 18) * 28}ms` }}>
      <span className="rv-chip-face">
        <Avatar person={person} />
        {person.has_plus_one && <span className="rv-plus">+1</span>}
      </span>
      <span className="rv-chip-name">{person.wall_name}</span>
    </li>
  );
}
