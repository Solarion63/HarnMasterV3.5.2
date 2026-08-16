const SECONDS_PER_MINUTE = 60;

export function elapsedBleeding({ lastProcessedWorldTime, worldTime, rate = 1 }) {
  const start = Number(lastProcessedWorldTime);
  const end = Number(worldTime);
  const bleedRate = Math.max(0, Number(rate) || 0);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || bleedRate <= 0) {
    return {
      minutes: 0,
      bloodloss: 0,
      nextProcessedWorldTime: Number.isFinite(start) ? start : end
    };
  }

  const minutes = Math.floor((end - start) / SECONDS_PER_MINUTE);
  return {
    minutes,
    bloodloss: minutes * bleedRate,
    nextProcessedWorldTime: start + (minutes * SECONDS_PER_MINUTE)
  };
}

export function bloodlossIsFatal(bloodloss, endurance) {
  return Math.max(0, Number(bloodloss) || 0) > Math.max(0, Number(endurance) || 0);
}

export function bloodRegenerationReduction(resultCode) {
  if (resultCode === "cs") return 2;
  if (resultCode === "ms") return 1;
  return 0;
}
