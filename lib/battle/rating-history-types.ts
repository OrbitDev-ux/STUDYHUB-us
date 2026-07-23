export interface RatingPoint {
  rating: number;
  rating_change: number;
  created_at: string;
  source: string;
  event_type?: string | null;
  event_id?: string | null;
  event_title?: string | null;
  event_href?: string | null;
  opponent_name?: string | null;
  opponent_id?: string | null;
  reason?: string | null;
  rating_before?: number;
  actual_rank?: number | null;
  expected_rank?: number | null;
  performance_rating?: number | null;
  base_delta?: number | null;
  correction?: number | null;
  provisional_factor?: number | null;
  event_score?: number | null;
  opponent_score?: number | null;
  response_ms?: number | null;
  opponent_response_ms?: number | null;
  solved?: number | null;
  penalty_seconds?: number | null;
  result_label?: string | null;
}
