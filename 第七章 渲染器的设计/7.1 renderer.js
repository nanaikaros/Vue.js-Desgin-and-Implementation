/**
 * 这一章主要是介绍了渲染器的实现
 */
//利用vue中的api实现渲染器的方法
const { effect, ref } = VueReactivity;
const count = ref(1);

effect(() => {
  renderer(`<h1>${count.value}</h1>`, document.getElementById("app"));
});

//最简单的渲染器实现
function renderer(domString, container) {
  container.innerHTML = domString;
}

count.value++;
