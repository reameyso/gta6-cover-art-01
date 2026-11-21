// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample photo loaded;
// ?shot=cover shows the exported cover alone, full frame. `photo` picks the hero sample
// (samples/<photo>.jpg) and `caption` the words; the other sample fills the side panels.
// window.__shotReady is set once the cover has painted.
export async function runShot(shot, query, app) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const heroName = query.get('photo') ?? 'pier';
  const otherName = heroName === 'pier' ? 'boulevard' : 'pier';
  const hero = await app.loadImage(`samples/${heroName}.jpg`);
  const other = await app.loadImage(`samples/${otherName}.jpg`);
  app.setPhotos(hero, other, hero);
  app.setCaption(query.get('caption') ?? 'Sunset Heist');
  app.setSize('square');
  app.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
