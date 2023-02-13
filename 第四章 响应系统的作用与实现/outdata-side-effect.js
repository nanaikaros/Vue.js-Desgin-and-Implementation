let activeEffect;
let effectStack = []; //利用数组去模拟栈的实现
let bucket = new WeakMap();
const data = { foo: 1, bar: 2 };
const obj = new Proxy(data, {
  get(target, key) {
    track(target, key);
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    trigger(target, key);
    return true;
  },
});

function cleanUp(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}
/***--------------------------------------------------- */
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanUp(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn); //当前的副作用函数押入栈中
    const res = fn();

    //将执行完的副作用函数弹出
    effectStack.pop();
    //activeEffect指向栈顶的下一个副作用函数
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  };

  effectFn.options = options;
  effectFn.deps = [];
  if (!options.lazy) {
    effectFn();
  }
  return effectFn; //返回副作用函数;
}

/**--------------------------------------------------------
 * trigger 函数
 */
function trigger(target, key) {
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

/**-------------------------------------------------------
 * track 函数
 */
function track(target, key) {
  console.log("track触发");
  if (!activeEffect) return;
  let despMap = bucket.get(target);
  if (!despMap) {
    bucket.set(target, (despMap = new Map()));
  }
  let deps = despMap.get(key);
  if (!deps) {
    despMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

/**------------------------------------------------ */
// const effectFn = effect(() => obj.bar + obj.foo, {
//   //lazy变量
//   lazy: true,
//   //调度器
//   // scheduler(fn) {
//   //   setTimeout(fn);
//   // },
// });

// const value = effectFn();
// console.log(value);
//obj.foo++; //这一步操作相当于先读取后写入 但读取操作未完成 所以写入会报错

/**
 * 计算属性
 * @param {*} getter
 * @returns
 */
function computed(getter) {
  let value; //存放上次计算的数值
  let dirty = true; //true代表数值需要重新计算，“脏”
  const effectFn = effect(getter, {
    lazy: true,
    //当修改data里面的数值的时候要进行调度操作，对dirty置于true使得值可以重新计算
    scheduler() {
      if (!dirty) {
        dirty = true;
        trigger(obj, "value");
      }
    },
  });

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };

  return obj;
}

/**
 * @param source 响应式数据
 * @param cb 回调函数
 */
function watch(source, cb, options = {}) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  //实现获取新值和旧值
  let oldVal, newVal;
  let cleanUp; //用于存储用户注册过期的回调函数
  function onInvalidate(fn) {
    cleanUp = fn;
  }

  const job = () => {
    newVal = effectFn();
    if (cleanUp) {
      cleanUp();
    }
    cb(newVal, oldVal, onInvalidate);
    oldVal = newVal;
  };
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: job,
  });
  if (options.immediate) {
    job();
  } else {
    oldVal = effectFn();
  }
}

function traverse(value, seen = new Set()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);

  for (const k in value) {
    //遍历obj里面的属性值
    traverse(value[k], seen);
  }
  return value;
}

let finalData;
watch(obj, async (newVal, oldVal, onInvalidate) => {
  let expired = false;
  onInvalidate(() => {
    expired = true;
  });
  const res = await fetch("/path/to/requset");
  if (!expired) {
    finalData = res;
  }
});

obj.foo++;
setTimeout(() => {
  obj.foo++;
}, 2000);
