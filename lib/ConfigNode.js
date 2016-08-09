/**
 * Created by feichenxi on 2016/8/9.
 */

'use strict';

var util = require('util');

/**
 * 构造函数
 *
 * @constructor
 */
function ConfigNode(type, name, httpClient, zkClient) {
    this.type = type;
    this.name = name;
    this._httpClient = httpClient;
    this._zkClient = zkClient;
    httpClient.getConfigFile(function () {
        
    });
    httpClient.getConfigItem(function () {
        
    });
}

ConfigNode.prototype.init = function () {
    var self = this;
    this._zkClient.nodeWatch(this, function () {
        self._zkClient.pushData();
    },function () {
        
    });
};

/**
 * 导出
 *
 * @type {Function}
 */
module.exports = ConfigNode;
