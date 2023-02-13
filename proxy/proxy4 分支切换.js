/*分支切换会导致产生遗留的副作用函数
如：
    data 
        ok
            effectFn
        text
            effectFn
*/
import track from "./track.js";
import trigger from "./trigger.js";
let activeEffect; // 用于存储副作用函数
let bucket = new WeakMap(); //Weakmap是弱引用 存储对象--key值 会被垃圾回收机制回收
const data = { ok: true, text: "hello world" };
const obj = new Proxy(data, {
  get(target, key) {
    activeEffect, (bucket = track(target, key, activeEffect, bucket));
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    trigger(target, key, bucket);
    return true;
  },
});

effect(() => {
  document.body.innerText = obj.ok ? obj.text : "not";
});

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

setTimeout(() => {
  obj.ok = false;
}, 2000);
