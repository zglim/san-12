/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 统一的组件解析模块
 *
 * 将 owner.components 查询、动态 is 组件名、componentName 覆盖、
 * fragment/template 特判、AsyncComponent loader 判断等分支逻辑
 * 收拢到一处，供 create-node / create-hydrate-node 共用。
 *
 * 解析结果的 type 字段含义：
 *   - 'element'   : 普通 Element（aNode.elem 已标记 或 fallback）
 *   - 'clazz'     : aNode.Clazz（preheat 阶段预设的 IfNode / ForNode / TextNode 等）
 *   - 'component' : owner.components 中注册的同步组件类
 *   - 'async'     : owner.components 中注册的异步 loader
 *   - 'fragment'  : is 指令 + fragment / template 特判
 */

var AsyncComponent = require('./async-component');


/**
 * 解析 aNode 对应的构造体
 *
 * @param {Object} aNode 抽象节点
 * @param {Component} owner 所属组件环境
 * @param {string=} componentName 外部指定的组件名（is 指令动态解析结果等）
 * @return {{type: string, Clazz: (Function|null), isLoader: boolean, loader: (Object|null)}}
 */
function resolveComponent(aNode, owner, componentName) {
    // 1. preheat 阶段已标记为纯 element
    if (aNode.elem) {
        return {type: 'element', Clazz: null, isLoader: false, loader: null};
    }

    // 2. preheat 阶段已绑定 Clazz（IfNode / ForNode / TextNode 等）
    if (aNode.Clazz) {
        return {type: 'clazz', Clazz: aNode.Clazz, isLoader: false, loader: null};
    }

    // 3. 在 owner.components 中查找
    var name = componentName || aNode.tagName;
    var ComponentOrLoader = owner.components && owner.components[name];

    if (ComponentOrLoader) {
        if (typeof ComponentOrLoader === 'function') {
            return {type: 'component', Clazz: ComponentOrLoader, isLoader: false, loader: null};
        }
        return {type: 'async', Clazz: null, isLoader: true, loader: ComponentOrLoader};
    }

    // 4. is 指令 + fragment / template 特判
    if (aNode.directives.is) {
        if (componentName === 'fragment' || componentName === 'template') {
            return {type: 'fragment', Clazz: null, isLoader: false, loader: null};
        }
    }
    else {
        // 没有 is 指令也没有匹配到组件 → 当作普通 element
        aNode.elem = true;
    }

    return {type: 'element', Clazz: null, isLoader: false, loader: null};
}


/**
 * 根据解析结果创建异步组件实例
 *
 * 单独抽出是因为 AsyncComponent 的构造参数在 create / hydrate
 * 两条链路里只差一个 hydrateWalker，用此方法统一拼装 options。
 *
 * @param {Object} aNode 抽象节点
 * @param {Node} parent 父亲节点
 * @param {Model} scope 所属数据环境
 * @param {Component} owner 所属组件环境
 * @param {Object} loader ComponentLoader 实例
 * @param {DOMChildrenWalker=} hydrateWalker 子元素遍历对象
 * @return {AsyncComponent}
 */
function createAsyncInstance(aNode, parent, scope, owner, loader, hydrateWalker) {
    var options = {
        source: aNode,
        owner: owner,
        scope: scope,
        parent: parent
    };

    // #[begin] hydrate
    if (hydrateWalker) {
        options.hydrateWalker = hydrateWalker;
    }
    // #[end]

    return new AsyncComponent(options, loader);
}


exports.resolveComponent = resolveComponent;
exports.createAsyncInstance = createAsyncInstance;
