/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 创建节点的工厂方法
 *
 * 装配决策顺序：
 *   1. aNode.elem   -> 已被标记为纯元素（preheat 阶段），直接创建 Element
 *   2. aNode.Clazz  -> 已被 preheat 绑定到特定节点类（if/for/text 等）
 *   3. owner.components 查询 -> 找到注册组件或 loader
 *      - function -> 同步组件实例化
 *      - object   -> 异步组件（ComponentLoader）
 *   4. s-is 指令特判 -> fragment / template 走 FragmentNode
 *   5. 兜底 -> 标记 aNode.elem 并创建 Element
 *
 * 组件解析的分支逻辑统一由 resolve-component.js 负责，
 * 这里只关心拿到结果后"怎么 new"。
 */

var Element = require('./element');
var FragmentNode = require('./fragment-node');
var resolveComponent = require('./resolve-component').resolveComponent;
var createAsyncInstance = require('./resolve-component').createAsyncInstance;


/**
 * 创建节点
 *
 * @param {ANode} aNode 抽象节点
 * @param {Node} parent 父亲节点
 * @param {Model} scope 所属数据环境
 * @param {Component} owner 所属组件环境
 * @param {string=} componentName 外部指定的组件名
 * @return {Node}
 */
function createNode(aNode, parent, scope, owner, componentName) {
    var resolved = resolveComponent(aNode, owner, componentName);

    switch (resolved.type) {
        case 'clazz':
            return new resolved.Clazz(aNode, parent, scope, owner);

        case 'component':
            return new resolved.Clazz({
                source: aNode,
                owner: owner,
                scope: scope,
                parent: parent
            });

        case 'async':
            return createAsyncInstance(aNode, parent, scope, owner, resolved.loader);

        case 'fragment':
            return new FragmentNode(aNode, parent, scope, owner);
    }

    // type === 'element'（包含 aNode.elem 预设 + fallback）
    return new Element(aNode, parent, scope, owner, componentName);
}

exports = module.exports = createNode;
