const departure = [
 ['🧳','Packing','Show us the suitcase, the checklist, or the outfit they picked for the trip.'],
 ['🤗','Goodbye hugs','Got a photo of that last squeeze before they left? Share it here.'],
 ['✈️','At the airport','Share a moment from check-in, the gate, or the first glimpse of the plane.'],
 ['🚌','On the way','What did the journey look like? Share a snapshot from the road.'],
];
const adventure = [
 ['📍','First stop','Share a glimpse of the first place they explored.'],
 ['😄','Made me laugh','Share a little moment that made everyone smile.'],
 ['⭐','Favorite moment','What’s a moment you’d love to remember? Share it here.'],
];
const partner = ['👯','Adventure partners','Share a photo of the friends who made the adventure even better.'];

export default function MomentPrompts({sendoff,onChoose,onChaperoneSignIn}) {
 const moments = sendoff ? [...departure,partner] : [...adventure,partner,...departure];
 return <section className="dc-moment-prompts" aria-labelledby="dc-moment-title">
  <div className="dc-moment-heading">
   <h3 id="dc-moment-title">Share a little moment</h3>
   {onChaperoneSignIn&&<button type="button" className="engine-link" onClick={onChaperoneSignIn}>Chaperone sign-in</button>}
  </div>
  <div className="dc-moment-pills">
   {moments.map(([icon,title,hint])=><button type="button" key={title} onClick={()=>onChoose({title,hint})}><span aria-hidden="true">{icon}</span> {title}</button>)}
  </div>
 </section>;
}
