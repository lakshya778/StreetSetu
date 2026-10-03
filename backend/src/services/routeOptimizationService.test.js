import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineDistanceKm, optimizeVisitOrder } from './routeOptimizationService.js';

test('Haversine distance returns approximate distance between known coordinates', () => {
  const distance = haversineDistanceKm([77.209, 28.6139], [77.219, 28.6139]);
  assert.ok(distance > 0.95 && distance < 1.05);
});

test('greedy route visits the nearest assignment first and sums route legs', () => {
  const assignments = [
    { _id: 'far', complaint: { location: { coordinates: [77.25, 28.61] } } },
    { _id: 'near', complaint: { location: { coordinates: [77.21, 28.61] } } },
    { _id: 'middle', complaint: { location: { coordinates: [77.23, 28.61] } } }
  ];
  const route = optimizeVisitOrder(assignments, [77.209, 28.61]);
  assert.deepEqual(route.assignments.map((item) => item._id), ['near', 'middle', 'far']);
  assert.equal(route.assignments[0].routeOrder, 1);
  assert.ok(route.totalDistanceKm > 0);
  assert.equal(route.estimatedTravelMinutes, Math.ceil((route.totalDistanceKm / 4.5) * 60));
});
