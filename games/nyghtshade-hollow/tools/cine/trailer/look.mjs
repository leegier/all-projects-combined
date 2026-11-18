// Shared looks (starting points: authors may tune per shot, but keep the film consistent). Spread into a shot's `fx`: { ...look('dawn'), dof: {...} }
const grade = (o) => ({ contrast: 1.12, sat: 0.92, vignette: 0.5, shadowTint: [-0.004, 0.006, 0.014], highlightTint: [0.03, 0.015, -0.004], blackLift: 0.01, ...o });
export const LOOKS = {
  dawn: { ev: 0.6, light: { hi: 1.8, ai: 1.6, fog: 1.3 }, bloom: 1.2, streak: { amount: 0.45, threshold: 2.8, len: 1 }, grade: grade({}) },                                  // C-Block, cool teal fill, warm practicals
  warm: { ev: 0.5, light: { hi: 1.6, ai: 1.5, fog: 1.3 }, bloom: 1.25, streak: { amount: 0.5, threshold: 2.6, len: 1 }, grade: grade({ sat: 0.96, highlightTint: [0.05, 0.025, -0.006], shadowTint: [0.0, 0.004, 0.01] }) },   // chapel, Records, canteen
  tunnel: { ev: 0.9, light: { hi: 2.2, ai: 2.0, fog: 1.0 }, bloom: 1.3, streak: { amount: 0.5, threshold: 2.4, len: 1 }, grade: grade({ sat: 0.88, highlightTint: [0.05, 0.025, -0.006], blackLift: 0.014 }) },
  gold: { ev: 0.1, light: { hi: 1.1, ai: 1.1, fog: 1.0 }, bloom: 1.1, streak: { amount: 0.6, threshold: 2.2, len: 1.2 }, grade: grade({ contrast: 1.1, sat: 1.05, vignette: 0.45, highlightTint: [0.05, 0.03, 0.0], shadowTint: [-0.01, 0.0, 0.02], blackLift: 0.008 }) },   // the forest and the clearing
  alarm: { ev: 0.5, light: { hi: 1.6, ai: 1.4, fog: 1.4 }, bloom: 1.3, streak: { amount: 0.6, threshold: 2.4, len: 1 }, grade: grade({ contrast: 1.18, sat: 0.9, shadowTint: [0.02, -0.004, -0.004] }) },
};
export const look = (name, over = {}) => ({ ...LOOKS[name], ...over });
