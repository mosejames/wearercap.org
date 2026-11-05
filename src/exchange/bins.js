// The existing focus field travels with a bin through every public/private
// payload and survives reassignment. Reserve this exact value for its scope.
export const isBottomsBin = (bin) => bin?.focus === 'Bottoms only';

export function binItemTypes(bin, types) {
  return types.filter((type) => {
    const bottoms = ['girls-bottoms', 'boys-bottoms'].includes(type.size_set)
      || ['pants', 'shorts', 'bottoms', 'skirt'].includes(type.id);
    return isBottomsBin(bin) ? bottoms : !bottoms;
  });
}
