/** How a medicine or supplement looks: shape and colour, shared by the picker and the icons. */
export const PILL_SHAPES = ["round", "oval", "capsule", "softgel", "liquid", "sachet", "drops", "inhaler", "injection"] as const;
export type PillShape = (typeof PILL_SHAPES)[number];
export const PILL_COLORS = ["white", "yellow", "orange", "pink", "red", "purple", "blue", "green", "brown", "grey"] as const;
export type PillColor = (typeof PILL_COLORS)[number];

export const PILL_HEX: Record<PillColor, string> = {
  white: "#f4f1ea", yellow: "#f4c84a", orange: "#f08a3c", pink: "#f29bb8", red: "#e0524a",
  purple: "#9a7ad6", blue: "#5a92e6", green: "#58b783", brown: "#9a6b46", grey: "#a3a7ad",
};
export const SHAPE_LABEL: Record<PillShape, string> = {
  round: "Round tablet", oval: "Oval tablet", capsule: "Capsule", softgel: "Soft gel", liquid: "Syrup", sachet: "Sachet / powder", drops: "Drops", inhaler: "Inhaler", injection: "Injection",
};
export const isShape = (v: unknown): v is PillShape => PILL_SHAPES.includes(v as PillShape);
export const isColor = (v: unknown): v is PillColor => PILL_COLORS.includes(v as PillColor);
