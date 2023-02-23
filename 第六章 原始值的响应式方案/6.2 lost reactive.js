/**
 * 这一节主要讲解如何应对响应丢失的问题
 * 所谓响应丢失就是 当我们重新修改响应式数据的值时，不会触发更新操作
 * 是因为使用了...（展开运算符导致的）
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
//将对象变为响应式数据
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

/***----------------注册副作用函数----------------------------------- */
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

/******************************************** */
function ref(val) {
  //在方法内部去封装一个对象
  const wrapper = {
    value: val,
  };
  //在该对象里面去添加一个__v_isRef属性用来标识是否为原始值的对象
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });

  return reactive(wrapper);
}

/**
 * 示例
 */
const obj = reactive({ foo: 1, bar: 2 });

//为了解决响应丢失的问题，需要在newObj内部去定义对象和obj一样，其实读取的就是obj对象下面的属性值
// const newObj = {
//   foo: {
//     get value() {
//       return obj.foo;
//     },
//   },
//   bar: {
//     get value() {
//       return obj.bar;
//     },
//   },
// };

// const newObj = {
//   foo: toRef(obj, "foo"),
//   bar: toRef(obj, "bar"),
// };

const newObj = { ...toRefs(obj) };

function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key];
    },
    set value(val) {
      obj[key] = val;
    },
  };
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });
  return wrapper;
}

//如果有obj的键特别多的话需要循环去赋值
function toRefs(obj) {
  const ret = {};
  for (const key in obj) {
    ret[key] = toRef(obj, key);
  }
  return ret;
}

effect(() => {
  console.log(newObj.foo.value);
});

obj.foo = 100;
