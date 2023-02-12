/*将2中的bucket进行重新设计，设计一个weakmap的方法进行实现副作用函数的绑定
(对象)  
target
    (属性)
    key
      (副作用函数)
      effectfn
*/
let activeEffect; // 用于存储副作用函数
let bucket = new WeakMap(); //Weakmap是弱引用 存储对象--key值 会被垃圾回收机制回收
const data = { text: "hello world" };
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
//注册一个effect函数进行赋值给全局的activeEffect
function effect(fn) {
  activeEffect = fn;
  fn();
}

effect(() => {
  console.log("effect run");
  document.body.innerText = obj.text;
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
}

function trigger(target, key) {
  const despMap = bucket.get(target);
  if (!despMap) return;
  const effects = despMap.get(key);
  effects && effects.forEach((fn) => fn());
}
