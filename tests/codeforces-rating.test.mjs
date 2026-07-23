import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCodeforcesRatings,
  expectedRank,
  provisionalFactor,
  winProbability,
} from "../lib/battle/codeforces-rating.ts";

test("win probabilities are symmetric", () => {
  assert.equal(winProbability(1200, 1200), 0.5);
  assert.ok(Math.abs(winProbability(1600, 1200) + winProbability(1200, 1600) - 1) < 1e-12);
});

test("expected ranks become better as the candidate rating rises", () => {
  const opponents = [1000, 1400, 1600];
  assert.ok(expectedRank(1800, opponents) < expectedRank(1200, opponents));
});

test("a new winner moves substantially faster than K=32 Elo", () => {
  const [winner, loser] = calculateCodeforcesRatings([
    { id: "winner", rating: 1200, rank: 1, ratedEvents: 0 },
    { id: "loser", rating: 1200, rank: 2, ratedEvents: 0 },
  ]);
  assert.ok(winner.delta >= 50);
  assert.ok(loser.delta <= -50);
});

test("provisional correction converges after six rated events", () => {
  assert.equal(provisionalFactor(0), 2);
  assert.equal(provisionalFactor(5), 1);
  assert.equal(provisionalFactor(100), 1);
});

test("higher contest places gain more rating", () => {
  const results = calculateCodeforcesRatings([
    { id: "first", rating: 1200, rank: 1, ratedEvents: 8 },
    { id: "second", rating: 1200, rank: 2, ratedEvents: 8 },
    { id: "third", rating: 1200, rank: 3, ratedEvents: 8 },
    { id: "fourth", rating: 1200, rank: 4, ratedEvents: 8 },
  ]);
  assert.ok(results[0].delta > results[1].delta);
  assert.ok(results[1].delta > results[2].delta);
  assert.ok(results[2].delta > results[3].delta);
  assert.ok(results.reduce((sum, result) => sum + result.delta, 0) <= 0);
});
