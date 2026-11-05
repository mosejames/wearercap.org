// Private attachment files remain available for editorial review. Only the
// contributor's story and chosen public action become an editable draft block.
export function submissionBlock(item) {
  return {
    id: 'submission-' + item.id,
    type: 'story',
    heading: item.title,
    body: item.details + (item.links ? '\n\n' + item.links : ''),
    ...(item.linkUrl ? {button: {label: item.actionText || 'Learn more', url: item.linkUrl}} : {}),
  };
}
