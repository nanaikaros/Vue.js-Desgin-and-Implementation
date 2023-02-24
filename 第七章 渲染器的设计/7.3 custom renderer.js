/**
 * 这一节主要是自行定义一个渲染器，渲染器有不同的对象，对于不同的对象有不同的处理方法
 */
const { effect, ref } = VueReactivity;

function createRenderer(options) {
  const { createElement, setElementText, insert } = options;
  //挂载函数
  function mountElement(vnode, container) {
    const el = createElement(vnode.type);

    if (typeof vnode.children === "string") {
      //如果vnode的孩子是字符串，代表该元素具有文本节点
      setElementText(el, vnode.children);
    }
    insert(el, container);
  }
  //patch函数
  function patch(n1, n2, container) {
    if (!n1) {
      //代表n1不存在
      mountElement(n2, container); //没有旧值代表挂载
    } else {
    }
  }
  //render函数
  function render(vnode, container) {
    if (vnode) {
      //如果新的vnode存在
      //则将其与旧的vnode传递给patch函数
      patch(container._vnode, vnode, container);
    } else {
      //如果新值不存在，并且旧值存在则代表要进行卸载操作，并将container.innerHTML清空
      if (container._vnode) {
        container.innerHTML = "";
      }
    }
    container._vnode = vnode;
  }

  return { render };
}
/**************************************************** */

//一个普通的h1标签
const vnode = {
  type: "h1",
  children: "hello",
};

const container = { type: "root" };

//为了不依赖浏览器平台的通用渲染器 在创建render的时候传入配置项
const renderer = createRenderer({
  createElement(tag) {
    console.log(`创建元素 ${tag}`);
    return { tag };
  },
  setElementText(el, text) {
    console.log(`设置 ${JSON.stringify(el)}的文本为：${text}`);
    el.textContent = text;
  },
  insert(el, parent, anchor = null) {
    console.log(`将${JSON.stringify(el)} 添加到 ${JSON.stringify(parent)}`);
    parent.children = el;
  },
});

renderer.render(vnode, container);
