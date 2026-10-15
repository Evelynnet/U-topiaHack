/**
 * AI extension point for listing review.
 *
 * Today AI_PROVIDER=none, so reviews are skipped. Later, add a provider here
 * that looks at the photos + claimed area/capacity and returns a ListingReview;
 * the result is stored in listings.ai_review and can be shown to admins.
 * Nothing else in the app needs to change. See docs/ROADMAP.md.
 */

export interface ListingReviewInput {
  title: string;
  description: string;
  areaSqm?: number;
  carCapacity: number;
  motorcycleCapacity: number;
  /** Public URLs (relative to the site) of uploaded photos. */
  photoUrls: string[];
}

export interface ListingReview {
  provider: string;
  /** 0..1 confidence that the claimed capacity matches the photos/area. */
  confidence: number | null;
  flags: string[];
  summary: string;
  suggestedCapacity?: { car: number; motorcycle: number };
}

export interface ListingReviewer {
  readonly name: string;
  review(input: ListingReviewInput): Promise<ListingReview | null>;
}

class NoopReviewer implements ListingReviewer {
  readonly name = "none";
  async review(): Promise<ListingReview | null> {
    return null;
  }
}

export function getReviewer(): ListingReviewer {
  switch (process.env.AI_PROVIDER) {
    // case "claude": return new ClaudeReviewer(process.env.AI_API_KEY!);
    default:
      return new NoopReviewer();
  }
}
