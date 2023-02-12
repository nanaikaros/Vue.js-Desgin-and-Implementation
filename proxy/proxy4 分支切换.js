/*分支切换会导致产生遗留的副作用函数
如：
    data 
        ok
            effectFn
        text
            effectFn
*/
let activeEffect; // 用于存储副作用函数
let bucket = new WeakMap(); //Weakmap是弱引用 存储对象--key值 会被垃圾回收机制回收
const data = { ok: true, text: "hello world" };
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

effect(() => {
  document.body.innerText = obj.ok ? obj.text : "not";
});

function track(target, key) {
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

function trigger(target, key) {
  const despMap = bucket.get(target);
  if (!despMap) return;
  const effects = despMap.get(key);

  //防止无限循环
  const effectsToRun = new Set(effects);
  effectsToRun.forEach((effectFn) => effectFn());
  //effects && effects.forEach((fn) => fn());
}

setTimeout(() => {
  obj.ok = false;
}, 2000);

//所以我们需要把所有与之关联的依赖集合给删除
//副作用函数执行完会重新建立联系
//注册一个effect函数进行赋值给全局的activeEffect
function effect(fn) {
  const effectFn = () => {
    cleanUp(effectFn); //调用cleanUp完成清除操作
    activeEffect = effectFn;
    fn();
  };
  effectFn.deps = [];
  effectFn();
  console.log(effectFn);
}

function cleanUp(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];

    deps.delete(effectFn);
  }
  effectFn.deps.length = 0;
}
