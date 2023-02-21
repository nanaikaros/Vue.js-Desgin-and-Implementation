/**
 * 这一节主要讲解的是如何代理集合类型，Set和Map
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

  console.log(type, key);
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

/**
 * 如何代理Map对象
 */
const s = new Set([1, 2, 3]);

//新建一个对象，用于存储自定义的方法
const mutableInstrumentations = {
  add(key) {
    //this指向代理对象，通过raw获取原始数据对象
    const target = this.raw;

    //判断是否给元素以及在Set里面则不需要添加了
    const hadKey = target.has(key);

    const res = target.add(key);
    if (!hadKey) {
      trigger(target, key, "ADD");
    }
    return res;
  },
  delete(key) {
    const target = this.raw;

    const hadKey = target.has(key);
    const res = target.delete(key);
    if (hadKey) {
      trigger(target, key, "DELETE");
    }
    return res;
  },
  forEach(callback, thisArg) {
    const wrap = (val) => (typeof val === "object" ? reactive(val) : val);

    const target = this.raw;

    track(target, ITERATE_KEY);

    //调用原始target的forEach方法
    target.forEach((v, k) => {
      callback.call(thisArg, wrap(v), wrap(k), this);
    });
  },
};

//利用createReactive里封装用于代理Set/Map类型的数据的逻辑
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === "raw") return target;
      if (key === "size") {
        //调用track函数建立响应联系
        track(target, ITERATE_KEY);
        //通过绑定target自身对象从而修复this指向的问题
        return Reflect.get(target, key, target);
      }

      //使用bind函数将用于操作数据的方法与原始的数据对象target做绑定
      return mutableInstrumentations[key];
    },
  });
}
// console.log(s.size);
// p.delete(1);
//s = [1,2,3]
// const p = createReactive(s);
// // console.log(p.size);
// effect(() => {
//   console.log(`p的长度为${p.size}`);
// });

// p.add(5);
// p.delete(5);

/**
 * 处理forEach,还是需要重写forEach方法
 */
const p = reactive(new Map([[{ key: 1 }, { value: 1 }]]));

effect(() => {
  p.forEach(function (value, key) {
    console.log(`key:${key} value:${value}`);
  });
});

p.set({ key: 2 }, { value: 2 });
