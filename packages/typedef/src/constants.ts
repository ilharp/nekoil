/**
 * deleted_reason 取值（含义见 common.ts 的 DatabaseBase）：
 *
 * 1=admin 2=user 3=TTL(过期)
 */
export const CP_DELETED_REASON = {
  UNDEFINED: 0,
  ADMIN: 1,
  USER: 2,
  TTL: 3,
} as const
