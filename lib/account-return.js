export function accountReturnPath(next) {
  if (next === "estimate") return "/estimate";
  if (next === "resume-estimate") return "/estimate?order=1";
  return "/account";
}
