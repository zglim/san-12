/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 数据代理
 */

var ExprType = require('../parser/expr-type');

/**
 * 基于 paths 构造 accessor 表达式
 *
 * @inner
 * @param {Array} paths 路径数组
 * @return {Object} ACCESSOR 表达式
 */
function accessorWithPaths(paths) {
    return {type: ExprType.ACCESSOR, paths: paths};
}

/**
 * 基于已有 paths + 一个属性名，构造新的 accessor 表达式
 *
 * @inner
 * @param {Array} paths 基础路径
 * @param {string} prop 追加的属性名
 * @return {Object} ACCESSOR 表达式
 */
function accessorAppend(paths, prop) {
    return accessorWithPaths(paths.concat({type: ExprType.STRING, value: prop}));
}


function dataProxy(data) {
    var proxies = {items: {}};
    return getPropProxy(data);

    function getPropProxy(data, target, basePaths, prop) {
        var proxyWrap = proxies;
        var paths;

        if (target) {
            for (var i = 0; i < basePaths.length; i++) {
                proxyWrap = proxyWrap.items[basePaths[i].value];
            }

            if (!proxyWrap.items[prop]) {
                proxyWrap.items[prop] = {items: {}};
            }

            proxyWrap = proxyWrap.items[prop];

            if (proxyWrap.proxy != null) {
                return proxyWrap.proxy;
            }

            paths = basePaths.concat({type: ExprType.STRING, value: prop});
        }
        else {
            target = data.raw;
            paths = [];

            data.listen(function (e) {
                proxies.items[e.expr.paths[0].value] = null;
            });
        }

        var arrayExpr = accessorWithPaths(paths);

        var handlers = {
            set: function (obj, prop, value) {
                data.set(accessorAppend(paths, prop), value);
                return true;
            },

            get: target instanceof Array
                ? function (arr, prop) {
                    switch (prop) {
                        case 'push':
                            return function () {
                                var arrLen = arr.length;
                                var argLen = arguments.length;

                                data.splice(
                                    arrayExpr,
                                    argLen === 1
                                        ? [arrLen, 0, arguments[0]]
                                        : [arrLen, 0].concat(Array.prototype.slice.call(arguments))
                                );

                                return arrLen + argLen;
                            };

                        case 'pop':
                            return function () {
                                var arrLen = arr.length;
                                if (arrLen) {
                                    return data.splice(arrayExpr, [arrLen - 1, 1])[0];
                                }
                            };

                        case 'shift':
                            return function () {
                                return data.splice(arrayExpr, [0, 1])[0];
                            };

                        case 'unshift':
                            return function () {
                                var arrLen = arr.length;
                                var argLen = arguments.length;

                                data.splice(
                                    arrayExpr,
                                    argLen === 1
                                        ? [0, 0, arguments[0]]
                                        : [0, 0].concat(Array.prototype.slice.call(arguments))
                                );

                                return arrLen + argLen;
                            };

                        case 'splice':
                            return function () {
                                return data.splice(
                                    arrayExpr,
                                    Array.prototype.slice.call(arguments)
                                );
                            };

                        case 'length':
                            return arr.length;
                    }

                    var value = arr[prop];
                    if (value && typeof value === 'object') {
                        return getPropProxy(data, value, paths, prop);
                    }

                    return value;
                }
                : function (obj, prop) {
                    var value = obj[prop];
                    if (value && typeof value === 'object') {
                        return getPropProxy(data, value, paths, prop);
                    }

                    return value;
                }
        };

        proxyWrap.proxy = new Proxy(target, handlers);
        return proxyWrap.proxy;
    }
}

exports = module.exports = dataProxy;
