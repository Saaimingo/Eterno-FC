import type { Foot, MatchPlayer } from "./contracts";

export type FootUse = Readonly<{
  foot: Foot;
  proficiency: number;
  dominantFoot: Foot;
  isWeakFoot: boolean;
}>;

function proficiency(player: MatchPlayer, foot: Foot) {
  return player.feet[foot] / 10;
}

export function dominantFootOf(player: MatchPlayer): Foot {
  return player.feet.left > player.feet.right ? "left" : "right";
}

export function resolveFootUse(
  player: MatchPlayer,
  requested: Foot | "either" = "either",
  forced = false,
): FootUse {
  const dominantFoot = dominantFootOf(player);
  const otherFoot: Foot = dominantFoot === "left" ? "right" : "left";
  let foot = requested === "either" ? dominantFoot : requested;

  if (
    requested !== "either"
    && !forced
    && player.feet.avoidsWeakFoot
    && proficiency(player, requested) + 15 < proficiency(player, requested === "left" ? "right" : "left")
  ) {
    foot = requested === "left" ? "right" : "left";
  }

  return Object.freeze({
    foot,
    proficiency: Number(proficiency(player, foot).toFixed(2)),
    dominantFoot,
    isWeakFoot: foot === otherFoot && proficiency(player, foot) + 10 < proficiency(player, dominantFoot),
  });
}

export function footTags(footUse: FootUse) {
  return Object.freeze([
    `foot:${footUse.foot}`,
    ...(footUse.isWeakFoot ? ["weak_foot"] : []),
  ]);
}
