/**
 * 这一节主要是讲解了 多次在同一container中渲染 要更新新的值 也就是patch打补丁的操作
 *
 */

const { effect, ref } = VueReactivity;

function createRenderer() {
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

const render = createRenderer();

render.render();
