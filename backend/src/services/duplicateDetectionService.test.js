import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, duplicateRadiusForCategory, scoreDuplicate, textSimilarity } from './duplicateDetectionService.js';

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

function complaintAtDistance(category, meters, { title, description } = {}) {
  const latitude = 28.6139;
  return {
    category,
    title: title || (category === 'roads' ? 'Large pothole near market' : 'Broken street light near market'),
    description: description || (category === 'roads' ? 'Deep pothole outside the market' : 'Street light is broken outside the market'),
    latitude,
    longitude: 77.209,
    location: { coordinates: [77.209, latitude + (meters / 111195)] }
  };
}

function scoreAt(category, meters) {
  const existing = complaintAtDistance(category, meters);
  return scoreDuplicate({
    category,
    title: existing.title,
    description: existing.description,
    latitude: existing.latitude,
    longitude: existing.longitude
  }, existing);
}

test('category-specific duplicate radii accept streetlights at 20m and 80m, reject 120m', () => {
  assert.equal(duplicateRadiusForCategory('street_lighting'), 100);
  assert.equal(scoreAt('street_lighting', 20).isDuplicate, true);
  assert.equal(scoreAt('street_lighting', 80).isDuplicate, true);
  assert.equal(scoreAt('street_lighting', 120).isDuplicate, false);
});

test('category-specific duplicate radii accept potholes at 20m and reject 60m', () => {
  assert.equal(duplicateRadiusForCategory('roads'), 50);
  assert.equal(scoreAt('roads', 20).isDuplicate, true);
  assert.equal(scoreAt('roads', 60).isDuplicate, false);
});

test('distance alone and different categories never produce an automatic duplicate', () => {
  const nearButUnrelated = complaintAtDistance('street_lighting', 5, {
    title: 'Street light near market',
    description: 'Street light is broken'
  });
  const distanceOnly = scoreDuplicate({
    category: 'street_lighting', title: 'Water leak', description: 'Pipe leaking by building', latitude: 28.6139, longitude: 77.209
  }, nearButUnrelated);
  assert.equal(distanceOnly.isDuplicate, false);

  const sameWordsDifferentCategory = complaintAtDistance('roads', 5, {
    title: 'Broken street light near market',
    description: 'Street light is broken outside the market'
  });
  const categoryMismatch = scoreDuplicate({
    category: 'street_lighting', title: sameWordsDifferentCategory.title, description: sameWordsDifferentCategory.description,
    latitude: sameWordsDifferentCategory.latitude, longitude: sameWordsDifferentCategory.longitude
  }, sameWordsDifferentCategory);
  assert.equal(categoryMismatch.categoryMatch, false);
  assert.equal(categoryMismatch.isDuplicate, false);
});
