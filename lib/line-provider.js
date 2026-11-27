export const lineOaEnabled = Boolean(process.env.AUTH_SECRET &&
  process.env.P3D_LINE_OA_ID?.trim() && process.env.P3D_LINE_OA_SECRET?.trim());

export const currentLineProvider = lineOaEnabled ? "line-oa" : "line";
