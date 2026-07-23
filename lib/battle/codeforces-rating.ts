export interface RatedParticipant {
  id: string;
  rating: number;
  rank: number;
  ratedEvents?: number;
}

export interface RatingCalculation extends RatedParticipant {
  expectedRank: number;
  performanceRating: number;
  baseDelta: number;
  correction: number;
  provisionalFactor: number;
  delta: number;
  newRating: number;
}

const MIN_RATING = 100;
const MAX_RATING = 5000;

/** Probability that player A beats player B on the 400-point Elo scale. */
export function winProbability(ratingA: number, ratingB: number) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** Codeforces' seed: one plus the sum of probabilities that every opponent wins. */
export function expectedRank(candidateRating: number, opponentRatings: number[]) {
  return 1 + opponentRatings.reduce(
    (sum, opponentRating) => sum + winProbability(opponentRating, candidateRating),
    0,
  );
}

export function performanceRating(targetRank: number, opponentRatings: number[]) {
  let low = MIN_RATING;
  let high = MAX_RATING;

  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (low + high) / 2;
    if (expectedRank(middle, opponentRatings) < targetRank) high = middle;
    else low = middle;
  }

  return Math.round((low + high) / 2);
}

/**
 * Early ratings need more movement because very little evidence exists.
 * The factor reaches 1.0 after six rated events.
 */
export function provisionalFactor(ratedEvents = 0) {
  return [2, 1.75, 1.5, 1.3, 1.15, 1][Math.min(Math.max(ratedEvents, 0), 5)]!;
}

export function calculateCodeforcesRatings(participants: RatedParticipant[]): RatingCalculation[] {
  if (participants.length < 2) {
    return participants.map((participant) => ({
      ...participant,
      expectedRank: 1,
      performanceRating: participant.rating,
      baseDelta: 0,
      correction: 0,
      provisionalFactor: provisionalFactor(participant.ratedEvents),
      delta: 0,
      newRating: participant.rating,
    }));
  }

  const initial = participants.map((participant, participantIndex) => {
    const opponentRatings = participants
      .filter((_, index) => index !== participantIndex)
      .map((opponent) => opponent.rating);
    const seed = expectedRank(participant.rating, opponentRatings);
    const targetRank = Math.sqrt(seed * participant.rank);
    const performance = performanceRating(targetRank, opponentRatings);
    const baseDelta = Math.round((performance - participant.rating) / 2);
    const factor = provisionalFactor(participant.ratedEvents);
    return {
      ...participant,
      expectedRank: seed,
      performanceRating: performance,
      baseDelta,
      provisionalFactor: factor,
      adjustedDelta: Math.round(baseDelta * factor),
    };
  });

  // Codeforces' first correction prevents rating inflation across the whole field.
  const firstCorrection = Math.round(
    -initial.reduce((sum, participant) => sum + participant.adjustedDelta, 0) / initial.length,
  ) - 1;
  const corrected = initial.map((participant) => ({
    ...participant,
    adjustedDelta: participant.adjustedDelta + firstCorrection,
    correction: firstCorrection,
  }));

  // A second, non-positive correction stabilizes the highest-rated part of the field.
  const topCount = Math.min(corrected.length, Math.max(1, Math.round(4 * Math.sqrt(corrected.length))));
  const top = [...corrected].sort((a, b) => b.rating - a.rating).slice(0, topCount);
  const topCorrection = Math.min(
    0,
    Math.max(-10, Math.round(-top.reduce((sum, participant) => sum + participant.adjustedDelta, 0) / topCount)),
  );

  return corrected.map((participant) => {
    const boundedDelta = Math.min(250, Math.max(-250, participant.adjustedDelta + topCorrection));
    const newRating = Math.min(MAX_RATING, Math.max(MIN_RATING, participant.rating + boundedDelta));
    return {
      id: participant.id,
      rating: participant.rating,
      rank: participant.rank,
      ratedEvents: participant.ratedEvents,
      expectedRank: participant.expectedRank,
      performanceRating: participant.performanceRating,
      baseDelta: participant.baseDelta,
      correction: participant.correction + topCorrection,
      provisionalFactor: participant.provisionalFactor,
      delta: newRating - participant.rating,
      newRating,
    };
  });
}
