export default function trigger(target, key, activeEffect, bucket) {
  console.log("trigger触发");
  const despMap = bucket.get(target);
  if (!despMap) return;
  const effects = despMap.get(key);

  //防止无限循环
  const effectsToRun = new Set();
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
  //effects && effects.forEach((fn) => fn());
}
