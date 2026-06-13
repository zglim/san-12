/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 通过组件反解创建节点的工厂方法
 *
 * 装配决策顺序与 create-node.js 完全一致，区别仅在于：
 *   - 所有节点构造都多传一个 hydrateWalker
 *   - 组件 / 异步组件通过 options.hydrateWalker 传入
 *   - FragmentNode / Element 等直接在构造参数末尾追加 hydrateWalker
 *
 * 组件解析的分支逻辑统一由 resolve-component.js 负责。
 */

var Element = require('./element');
var FragmentNode = require('./fragment-node');
var resolveComponent = require('./resolve-component').resolveComponent;
var createAsyncInstance = require('./resolve-component').createAsyncInstance;

// #[begin] hydrate
/**
 * 通过组件反解创建节点
 *
 * @param {ANode} aNode 抽象节点
 * @param {Node} parent 父亲节点
 * @param {Model} scope 所属数据环境
 * @param {Component} owner 所属组件环境
 * @param {DOMChildrenWalker} hydrateWalker 子元素遍历对象
 * @param {string=} componentName 外部指定的组件名
 * @return {Node}
 */
function createHydrateNode(aNode, parent, scope, owner, hydrateWalker, componentName) {
    var resolved = resolveComponent(aNode, owner, componentName);

    switch (resolved.type) {
        case 'clazz':
            return new resolved.Clazz(aNode, parent, scope, owner, hydrateWalker);

        case 'component':
            return new resolved.Clazz({
                source: aNode,
                owner: owner,
                scope: scope,
                parent: parent,
                hydrateWalker: hydrateWalker
            });

        case 'async':
            return createAsyncInstance(
                aNode, parent, scope, owner, resolved.loader, hydrateWalker
            );

        case 'fragment':
            return new FragmentNode(aNode, parent, scope, owner, hydrateWalker);
    }

    // type === 'element'（包含 aNode.elem 预设 + fallback）
    return new Element(aNode, parent, scope, owner, componentName, hydrateWalker);
}
// #[end]

exports = module.exports = createHydrateNode;
