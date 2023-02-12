/*设计更完善的一个响应系统，proxy1.js中的方法存在问题：
①将副作用函数进行硬编码
②若先进行写入操作，后进行读取操作则会存在空数组问题

下面使用一个全局变量进行改造
*/
let activeEffect; // 用于存储副作用函数
let bucket = new Set();
const data = { text: "hello world" };
const obj = new Proxy(data, {
  get(target, key) {
    if (activeEffect) {
      bucket.add(activeEffect);
    }
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    bucket.forEach((fn) => fn());
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

//在对不存在的属性进行赋值时，不应该调用副作用函数，但此时却调用了两次
setTimeout(() => {
  obj.notExist = "hello vue3";
}, 1000);
//所以需要将bucket进行重新的设计
