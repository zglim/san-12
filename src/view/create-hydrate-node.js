/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file hydrate 链路的节点工厂入口
 *
 * 委托给统一的 createNode 工厂，仅做参数顺序适配：
 *   createHydrateNode(aNode, parent, scope, owner, hydrateWalker, componentName)
 *     → createNode(aNode, parent, scope, owner, hydrateWalker, componentName)
 *
 * 所有节点装配逻辑集中在 create-node.js 中，
 * 本文件只保留 hydrate 专用的调用签名以兼容现有调用方。
 */

var createNode = require('./create-node');

// #[begin] hydrate
/**
 * 通过组件反解创建节点
 *
 * @param {ANode} aNode 抽象节点
 * @param {Node} parent 父亲节点
 * @param {Model} scope 所属数据环境
 * @param {Component} owner 所属组件环境
 * @param {DOMChildrenWalker} hydrateWalker 子元素遍历对象
 * @param {string} componentName 组件名（动态 is 时使用）
 * @return {Node}
 */
function createHydrateNode(aNode, parent, scope, owner, hydrateWalker, componentName) {
    return createNode(aNode, parent, scope, owner, hydrateWalker, componentName);
}
// #[end]

exports = module.exports = createHydrateNode;
