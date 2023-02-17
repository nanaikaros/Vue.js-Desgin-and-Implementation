/**
 * 这一节主要讲解的是如何正确的触发响应
 */
const obj = {};
const proto = { bar: 1 };
const child = reactive(obj);
const parent = reactive(proto);
//设置parent是child的原型
Object.setPrototypeOf(child, proto);

let activeEffect;
let effectStack = [];
let bucket = new WeakMap();
const ITERATE_KEY = Symbol();
/**--------------------------------------------------------
 * trigger 函数  type表明了传入的是设置值还是新的属性
 */
function trigger(target, key, type) {
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

  console.log(type, key);
  if (type === "ADD" || type === "DELETE") {
    //取得与ITERATE_KEY相关联的副作用函数
    console.log("ITERATE_KEY相关联的副作用函数触发");
    const iterateEffects = despMap.get(ITERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
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

/***--------------------------------------------------- */
function cleanUp(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}
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

/**
 * 代理函数
 */
// const p = new Proxy(obj, {
//   set(target, key, newVal, receiver) {
//     const oldVal = target[key];

//     const type = Object.prototype.hasOwnProperty.call(target, key);
//     const res = Reflect.set(target, key, newVal, receiver);
//     //要多加一个条件，旧值等于旧值，新值等于新值 为了避免NaN的情况出现
//     if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
//       trigger(target, key, type);
//     }
//     return res;
//   },
// });

// //当没有改变原始值时不需要触发trigger函数
// p.foo = 1;
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      //child.raw === obj (true)
      if (key === "raw") {
        return target;
      }
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, newVal, receiver) {
      const oldVal = target[key];

      const type = Object.prototype.hasOwnProperty.call(target, key)
        ? "SET"
        : "ADD";
      const res = Reflect.set(target, key, newVal, receiver);
      //要多加一个条件，旧值等于旧值，新值等于新值 为了避免NaN的情况出现
      //如果target等于receiver.raw则说明receiver就是target的代理对象
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type);
        }
      }
      return res;
    },
  });
}

effect(() => {
  console.log(child.bar);
});

child.bar = 2;
