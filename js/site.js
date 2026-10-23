/* Shared data registry. Each file in sections/ calls section(region, notes).
   Script order in index.html decides region order on the page. */
const REGIONS = [];
const NOTES = [];
function section(region, notes) {
  REGIONS.push(region);
  for (const n of notes) NOTES.push(Object.assign({ region: region.id }, n));
}
