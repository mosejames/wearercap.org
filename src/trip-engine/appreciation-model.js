export function appreciationFor(trip) {
 return {
  enabled: trip?.slug === 'washington-dc-2030',
  title: 'Love from families',
  thankYouHeading: `Thank you for bringing ${trip?.destination || 'the trip'} home.`,
  thankYouMessage: 'Your photos gave families a way to share in the trip. We’re grateful for the time and care you gave our class.',
  ...trip?.appreciation,
 };
}
