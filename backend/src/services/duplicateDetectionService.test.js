import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, scoreDuplicate, textSimilarity } from './duplicateDetectionService.js';

test('text similarity handles punctuation, casing, and close title typos', () => {
  assert.ok(textSimilarity('Broken street light!', 'broken street lite') > 0.7);
  assert.ok(textSimilarity('Pothole near school gate', 'school gate pothole') > 0.5);
  assert.ok(textSimilarity('Overflowing garbage', 'Unsafe open drain') < 0.4);
});

test('location proximity is measured in meters and contributes to duplicate confidence', () => {
  const meters = distanceMeters([77.209, 28.6139], [77.2091, 28.6139]);
  assert.ok(meters > 0 && meters < 20);
  const score = scoreDuplicate({ category: 'roads', title: 'Large pothole', description: 'Deep pothole outside the market', latitude: 28.6139, longitude: 77.209 }, {
    category: 'roads', title: 'Large pot hole', description: 'Deep pothole outside market', location: { coordinates: [77.2091, 28.6139] }
  });
  assert.ok(score.confidence > 62);
  assert.equal(score.distanceMeters, Math.round(meters));
});
