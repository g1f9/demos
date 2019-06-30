/* vue 响应式设计 demo
  主要由数据劫持，Watcher 观察者，Dep 依赖管理组成。是观察者模式的一种实现。
*/
/*        utils start        */
const nextTick = (function() {
  const callbacks = [];
  let flushing = false;
  let macroTask;
  let microTask;
  let _resolve;
  function isNative(Ctor) {
    return typeof Ctor === "function" && /native code/.test(Ctor.toString());
  }
  if (typeof setImmediate !== "undefined" && isNative(setImmediate)) {
    macroTask = setImmediate;
  } else if (typeof MessageChannel !== "undefined") {
    const { port1, port2 } = new MessageChannel();
    macroTask = function(cb) {
      port2.onmessage = cb;
      port1.postMessage(1);
    };
  } else {
    macroTask = cb => {
      setTimeout(cb, 0);
    };
  }
  if (typeof Promise !== "undefined" && isNative(Promise)) {
    microTask = cb => {
      Promise.resolve().then(cb);
    };
  } else {
    microTask = macroTask;
  }
  function flushCallbacks() {
    const copies = callbacks.slice();
    callbacks.length = 0;
    flushing = false;
    for (const cb of copies) {
      cb();
    }
  }
  return function(cb, ctx) {
    callbacks.push(() => {
      if (cb) {
        try {
          cb.call(ctx);
        } catch (error) {}
      } else if (_resolve) {
        _resolve(ctx);
      }
    });
    if (!flushing) {
      flushing = true;
      microTask(flushCallbacks);
    }
    return new Promise((rs, rj) => {
      _resolve = rs;
    });
  };
})();

/*        utils end        */

let depId = 0;
class Dep {
  constructor() {
    this.id = ++depId;
    this.subs = [];
  }
  depend() {
    if (Dep.target) {
      Dep.target.addDep(this);
    }
  }
  addSub(watcher) {
    this.subs.push(watcher);
  }
  removeSub(watcher) {
    let subs = this.subs;
    for (let i = 0, len = subs.length; i < len; i++) {
      if (subs[i] === watcher) {
        subs.splice(i, 1);
      }
    }
  }
  notify() {
    const subs = this.subs.slice();
    for (const sub of subs) {
      sub.update();
    }
  }
}
Dep.target = null;

let watchId = 0;
let watcherStack = [];
function pushTarget(watcher) {
  watcherStack.push(Dep.target);
  Dep.target = watcher;
}
function popTarget() {
  Dep.target = watcherStack.pop();
}
const queue = [];
const has = {};

function queueWatcher(watcher) {
  let id = watcher.id;
  if (!has[id]) {
    has[id] = true;
    queue.push(watcher);
  }
  nextTick(flushScheduleQueue);
}
function flushScheduleQueue() {
  queue.sort((a, b) => {
    a.id - b.id;
  });
  for (const watcher of queue) {
    let id = watcher.id;
    has[id] = false;
    watcher.run();
    if (has[id]) {
      console.log("you may has circle watch");
    }
  }
}

class Watcher {
  constructor(vm, fn, cb) {
    vm.watchers || (vm.watchers = []);
    vm.watchers.push(this);
    this.id = ++watchId;
    this.newDepIds = new Set();
    this.newDeps = [];
    this.depIds = new Set();
    this.deps = [];
    this.getter = fn;
    this.vm = vm;
    this.get();
  }
  get() {
    pushTarget(this);
    let value = this.getter.call(vm, vm);
    popTarget();
    this.cleanupDeps();
  }
  addDep(dep) {
    let id = dep.id;
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id);
      this.newDeps.push(dep);
      if (!this.depIds.has(id)) {
        dep.addSub(this);
      }
    }
  }
  cleanupDeps() {
    let deps = this.deps;
    for (const dep of deps) {
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this);
      }
    }
    let tmp = this.newDepIds;
    this.newDepIds = this.depIds;
    this.depIds = tmp;
    this.newDepIds.clear();

    tmp = this.newDeps;
    this.newDeps = this.deps;
    this.deps = tmp;
    this.newDeps.length = 0;
  }
  update() {
    queueWatcher(this);
  }
  run() {
    const value = this.get();
    if (value !== this.value) {
      console.log(`do watcher callback with old: ${this.value} new:${value} `);
      this.value = value;
    }
  }
}

class Observer {
  constructor(data) {
    this.value = data;
    Object.defineProperty(data, "__ob__", this);
    for (const key of Object.keys(data)) {
      defineReactive(data, key);
    }
  }
}

function defineReactive(target, key) {
  const dep = new Dep();
  let val = target[key];
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get() {
      console.log("依赖收集");
      dep.depend();
      return val;
    },
    set(v) {
      val = v;
      dep.notify();
    }
  });
}
function proxy(vm, sKey, key) {
  let descriptor = {
    enumerable: true,
    configurable: true,
    get() {
      return this[sKey][key];
    },
    set(val) {
      this[sKey][key] = val;
    }
  };
  Object.defineProperty(vm, key, descriptor);
}
function forEachValue(obj, fn) {
  for (const key of Object.keys(obj)) {
    fn(obj[key], key);
  }
}
function mixin(vm) {
  let data = vm.data;
  if (data) {
    for (const key of Object.keys(data)) {
      proxy(vm, "data", key);
    }
  }
  let computed = vm.computed;
  forEachValue(computed, function(getter, key) {
    new Watcher(vm, getter);
    Object.defineProperty(vm, key, {
      get: () => getter.call(vm)
    });
  });
}
