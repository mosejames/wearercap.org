import React from 'react';
import { CLASSES, HOUSES } from '../recap/config.js';

function Choice({ name, value, color }) {
  return <label className="sharing-chip">
    <input type="checkbox" name={name} value={value}/>
    <span>{color && <i style={{ backgroundColor: color }} aria-hidden="true"/>}{value}</span>
  </label>;
}

export function readSharingDetails(form) {
  const fields = new FormData(form);
  return {
    speakerName: String(fields.get('speakerName') ?? '').trim(),
    studentOrFamilyName: String(fields.get('studentOrFamilyName') ?? '').trim(),
    houses: fields.getAll('houses'),
    classYears: fields.getAll('classYears'),
  };
}

export default function SharingDetails({ photo = false }) {
  return <section className="sharing-details" aria-labelledby="sharing-title">
    <h2 id="sharing-title">Who’s sharing?</h2>
    <label className="sharing-name">Your name
      <input name="speakerName" autoComplete="name" maxLength={photo ? 60 : 100} placeholder={photo ? "Name of the person writing the card" : "Name of the person in the video"} required/>
    </label>
    <details>
      <summary>Add your RCA crew <span className="hint">Optional</span></summary>
      <label className="sharing-name">Student or family name
        <input name="studentOrFamilyName" maxLength={100} placeholder="Whatever name works for your family"/>
      </label>
      <p className="hint">Tap all that apply.</p>
      <fieldset className="sharing-choices">
        <legend>Houses</legend>
        <div>{HOUSES.map(house => <Choice key={house.id} name="houses" value={house.name} color={house.color}/>)}</div>
      </fieldset>
      <fieldset className="sharing-choices">
        <legend>Class years</legend>
        <div>{CLASSES.map(year => <Choice key={year} name="classYears" value={year}/>)}</div>
      </fieldset>
    </details>
  </section>;
}
