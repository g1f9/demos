/*
  小型 Vuex demo，去除掉模块机制，插件，订阅等，直观学习 vuex 基本工作原理
*/
function forEachValue(obj, fn) {
  Object.keys(obj).forEach(key => fn(obj[key], key));
}
function isPromise(val) {
  return val && typeof val.then === "function";
}
function registerMutation(store, state, fn, key) {
  let mutations = store._mutations[key] || (store._mutations[key] = []);
  mutations.push(function mutationWraper(payload) {
    return fn.call(store, state, payload);
  });
}
function registerAction(store, state, handler, key) {
  let entry = store._actions[key] || (store._actions[key] = []);
  entry.push(function actionWrapper(payload) {
    let res = handler.call(
      store,
      {
        commit: store.commit,
        dispatch: store.dispatch,
        state
      },
      payload
    );
    if (!isPromise(res)) {
      res = Promise.resolve(res);
    }
    return res;
  });
}
function registerGetters(store, handler, key) {
  store._wrapperGetters[key] = function wrapperGet() {
    return handler(store.state, store.getters);
  };
}
class Store {
  constructor(options) {
    this._mutations = Object.create(null);
    this._actions = Object.create(null);
    this._commiting = false;
    this._wrapperGetters = Object.create(null);
    const store = this;
    const state = options.state;
    const { commit, dispatch } = this;
    this.commit = function boundCommit(type, payload) {
      return commit.call(store, type, payload);
    };
    this.dispatch = function boundDispatch(type, payload) {
      return dispatch.call(store, type, payload);
    };
    this.installModule(store, state, options);
    this.resetStoreVm(state);
  }
  get state() {
    return this._vm._data.$$state;
  }
  installModule(store, state, options) {
    forEachValue(options.mutations, (fn, key) => {
      registerMutation(store, state, fn, key);
    });
    forEachValue(options.actions, (handler, key) => {
      registerAction(store, state, handler, key);
    });
    forEachValue(options.getters, (handler, key) => {
      registerGetters(store, handler, key);
    });
  }
  resetStoreVm(state) {
    const store = this;
    store.getters = {};
    const computed = {};
    forEachValue(store._wrapperGetters, (fn, key) => {
      computed[key] = function() {
        return fn(store);
      };
      Object.defineProperty(store.getters, key, {
        get: () => store._vm[key]
      });
    });
    store._vm = new Vue({
      data: {
        $$state: state
      },
      computed
    });
    this.enableStrictMode(store);
  }
  enableStrictMode(store) {
    store._vm.$watch(
      function() {
        return this._data.$$state;
      },
      () => {
        console.log("watcher callback");
        if (!store._commiting) {
          console.warn("do not mutate vuex store outsize mutation handlers");
        }
      },
      { deep: true, sync: true }
    );
  }
  commit(type, payload) {
    let entry = this._mutations[type];
    if (!entry) {
      throw `not install such mutation ${type}`;
    }
    entry.forEach(handler => {
      this._withCommit(() => {
        return handler(payload);
      });
    });
  }
  _withCommit(fn) {
    let commiting = this._commiting;
    this._commiting = true;
    fn();
    console.log("after handler");
    this._commiting = commiting;
  }
  dispatch(type, payload) {
    let entry = this._actions[type];
    if (!entry) {
      console.error(`undefined ${type} action`);
      return;
    }
    return entry.length > 1
      ? Promise.all(
          entry.map(handler => {
            return handler(payload);
          })
        )
      : entry[0](payload);
  }
}
