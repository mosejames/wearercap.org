// Shared with the main website. Add public destinations in community/content.json.
import content from '../community/content.json';
export const links = content.tools.filter(tool => tool.app !== false);
export const groups = content.groups;
