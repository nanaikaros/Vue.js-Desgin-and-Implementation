const bucket = new Set();

const data = { text: "hello world", text2: "hello world2" };
const obj = new Proxy(data, {
  get(target, key) {
    bucket.add(effect);
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    bucket.forEach((fn) => fn());
    return true;
  },
});

function effect() {
  document.body.innerHTML = obj.text; //做读取操作
}

effect();
setTimeout(() => {
  obj.text = "jakldf"; //做写入操作
}, 1000);
