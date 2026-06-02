// Shared reaction constants/types. Kept out of the "use server" actions file,
// which may only export async functions.

export type ReactionKind = "saw" | "proud";

export const REACTION_LABELS: Record<ReactionKind, string> = {
  saw: "Saw it",
  proud: "Proud",
};

export const REACTION_EMOJI: Record<ReactionKind, string> = {
  saw: "👀",
  proud: "👏",
};
