export const GENERAL_REACTIONS=[['love','❤️','Love'],['celebrate','🎉','Celebrate'],['thanks','💙','Thank you'],['amazing','🤩','Amazing'],['bravo','👏','Bravo']];
export const TRUNK_REACTIONS=[['love','❤️','Love'],['spooky','👻','Spooky'],['costume','🎃','Great costume'],['fun','🙌','So much fun'],['thanks','💙','Thank you']];
export const ALL_PHOTO_REACTIONS=[...GENERAL_REACTIONS,...TRUNK_REACTIONS.filter(([id])=>!GENERAL_REACTIONS.some(([key])=>key===id))];
export function reactionOptions(slug){return ['rcap-trunk-or-treat-2026','rcap-trunk-or-treat-photo-booth'].includes(slug)?TRUNK_REACTIONS:GENERAL_REACTIONS;}
