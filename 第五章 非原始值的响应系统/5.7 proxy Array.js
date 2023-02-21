/**
 * 这一节讲的是代理数组的类型该如何实现
 */
/**
 * 这一节主要讲解的是如何正确的触发响应
 */
let activeEffect;
let effectStack = [];
let bucket = new WeakMap();
const ITERATE_KEY = Symbol();

//隐式修改数组长度的声明
const arr = reactive([]);
let shouldTrack = true;
const arrayInstrumentations = {};
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

  //   console.log(type, key);
  if (type === "ADD" || type === "DELETE") {
    //取得与ITERATE_KEY相关联的副作用函数
    console.log("取得与ITERATE_KEY相关联的副作用函数");
    const iterateEffects = despMap.get(ITERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  if (type === "ADD" || Array.isArray(target)) {
    //取得与ITERATE_KEY相关联的副作用函数
    console.log("取得与length相关联的副作用函数");
    const lengthEffects = despMap.get("length");
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
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
  if (!activeEffect || !shouldTrack) return;
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
 * 对数组的读取操作
 * 1. 通过索引访问数组元素值 arr[0]
 * 2. 访问数组的长度： arr.length
 * 3. 把数组作为对象，使用for ... in循环遍历
 * 4. 使用for ... of 迭代遍历数组
 * 5. 数组的原型方法
 */

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

      const type = Array.isArray(target)
        ? Number(key) < target.length
          ? "SET"
          : "ADD"
        : Object.prototype.hasOwnProperty.call(target, key)
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
    ownKeys(target) {
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });
}
// const arr = reactive(["foo"]);
//通过数组的索引访问元素

// effect(() => {
//   console.log(arr[0]);
// });

// arr[0] = "bar";

//访问数组的长度
// effect(() => {
//   console.log(arr.length);
// });

// arr[1] = "bar";
// console.log(arr.length);

//把数组作为对象，使用for ... in循环遍历
// effect(() => {
//   for (const key in arr) {
//     console.log(key);
//   }
// });

// arr[1] = "bar";
// arr.length = 0;

//使用for ... of 迭代遍历数组
// const arr = [1, 2, 3, 4, 5];
// arr[Symbol.iterator] = function () {
//   const target = this;
//   const len = target.length;
//   let index = 0;

//   return {
//     next() {
//       return {
//         value: index < len ? target[index] : undefined,
//         done: index++ >= len,
//       };
//     },
//   };
// };

//数组的查找方法
// const obj = {};
// const arr = reactive([1, 2]);

// effect(() => {
//   console.log(arr.includes(1));
// });

// arr[0] = 3;
/**
 * 对数组的设置操作
 * 1. 通过索引修改数组元素值 arr[1] = 3
 * 2. 修改数组的长度： arr.length = 0;
 * 3. 数组的栈方法： push/pop/shift/unshift
 * 4. 修改原数组的原型方法： splice/fill/sort
 */

//数组的栈方法： push/pop/shift/unshift
//会隐式修改数组长度的原型方法

//重写push方法

["push"].forEach((method) => {
  //拿到原始方法
  const originMethod = Array.prototype[method];

  arrayInstrumentations[method] = function (...args) {
    shouldTrack = false;
    let res = originMethod.apply(this, args);
    shouldTrack = true;
    return res;
  };
});

effect(() => {
  arr.push(1);
});
effect(() => {
  arr.push(1);
});
