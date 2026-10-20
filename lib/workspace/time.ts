// Form values are wall-clock times in the explicitly selected zone, not the device zone.
export function wallTime(iso: string, zone: string) {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}
export function zonedInstant(local: string, zone: string) {
  const target = Date.parse(local + "Z");
  if (!Number.isFinite(target)) throw new Error("Date invalide.");
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const represented = Date.parse(
      wallTime(new Date(instant).toISOString(), zone) + "Z",
    );
    const delta = target - represented;
    if (!delta) break;
    instant += delta;
  }
  if (wallTime(new Date(instant).toISOString(), zone) !== local)
    throw new Error(
      "Horário inexistente na mudança de hora. Escolha outro horário.",
    );
  // Do not silently choose one of the two repeated times at the autumn transition.
  if (
    [-3600000, 3600000].some(
      (d) => wallTime(new Date(instant + d).toISOString(), zone) === local,
    )
  )
    throw new Error(
      "Horário ambíguo na mudança de hora. Use UTC para esta entrevista.",
    );
  return new Date(instant).toISOString();
}
