/**
 * 如何代理Object主要分为三部分的代理
 * 1. 访问属性：obj.foo
 * 2. 判断对象或原型是否在给定的key：key in obj
 * 3. 使用for ... in 循环遍历对象
 * 4. 删除对象中的属性
 */
const obj = { foo: 1 };
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

//1.代理访问属性的时候可以直接使用get来进行拦截
// const p = new Proxy(obj, {
//   get(target, key, receiver) {
//     track(target, key);
//     return Reflect.get(target, key, receiver);
//   },
// });

//console.log(p.foo);

//2.对于代理in操作符
// const p = new Proxy(obj, {
//   has(target, key) {
//     track(target, key);
//     return Reflect.has(target, key);
//   },
// });

// effect(() => {
//   "foo" in p;
// });

//3.对于for ... in 循环
// const p = new Proxy(obj, {
//   //   get(target, key, receiver) {
//   //     track(target, key);
//   //     return Reflect.get(target, key, receiver);
//   //   },
//   ownKeys(target) {
//     track(target, ITERATE_KEY);
//     return Reflect.ownKeys(target);
//   },
//   set(target, key, newVal, receiver) {
//     const res = Reflect.set(target, key, newVal, receiver);
//     const type = Object.prototype.hasOwnProperty.call(target, key)
//       ? "SET"
//       : "ADD";
//     trigger(target, key, type);
//     return res;
//   },
// });

// effect(() => {
//   for (const key in p) {
//     console.log(key);
//   }
// });

// p.foo = 2;

//4. 对象属性的删除
const p = new Proxy(obj, {
  get(target, key, receiver) {
    console.log("get触发");
    track(target, key);
    return Reflect.get(target, key, receiver);
  },
  set(target, key, newVal, receiver) {
    console.log("set触发");
    const res = Reflect.set(target, key, newVal, receiver);

    const type = Object.prototype.hasOwnProperty.call(target, key)
      ? "SET"
      : "ADD";
    trigger(target, key, type);
    return res;
  },
  deleteProperty(target, key) {
    const hadKey = Object.prototype.hasOwnProperty.call(target, key);
    // console.log(Object.prototype.hasOwnProperty.call(target, key));
    const res = Reflect.deleteProperty(target, key);

    if (res && hadKey) {
      trigger(target, key, "DELETE");
    }
    return res;
  },
  ownKeys(target) {
    track(target, ITERATE_KEY);
    return Reflect.ownKeys(target);
  },
});

effect(() => {
  for (const key in p) {
    console.log(key);
  }
});

p.bar = 2;
