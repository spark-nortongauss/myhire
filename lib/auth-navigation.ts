export function safeNext(value: string | null) {
  if (
    !value ||
    !/^\/(dashboard|jobs|interview-prep|preparation|files|settings|job-finder)(\/|\?|$)/.test(
      value,
    ) ||
    /[\\\r\n]/.test(value)
  )
    return "/dashboard";
  return value;
}
