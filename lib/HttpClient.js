/**
 * Created by Corey600 on 2016/8/2.
 */

'use strict';

var util = require('util');
var _ = require('lodash');
var request = require('request');
var debug = require('debug');

var error = debug('node-disconf-client:error');
var warn = debug('node-disconf-client:warn');

/**
 * 请求协议
 *
 * @type {string}
 */
var PROTOCOL = 'http://';

/**
 * 获取zookeeper信息接口
 *
 * @type {{HOSTS: string, PREFIX: string}}
 */
var ZOO_PATH = {
    HOSTS: '/api/zoo/hosts',
    PREFIX: '/api/zoo/prefix'
};

/**
 * 获取配置信息接口
 *
 * @type {{ITEM: string, FILE: string}}
 */
var CONFIG_PATH = {
    ITEM: '/api/config/item',
    FILE: '/api/config/file'
};

/**
 * 构造函数
 *
 * @param {string} hosts 配置服务器的HOST，用逗号分隔
 * @constructor
 */
function HttpClient(hosts) {
    var list = hosts.split(',');
    this._host = list.map(function (item) {
        if (item.indexOf(PROTOCOL) >= 0) {
            return item;
        }
        return PROTOCOL + item;
    });
}

/**
 * 发起 http 请求，如果失败则尝试下一个地址
 *
 * @param {number} index
 * @param {string} path
 * @param {Function} cb
 * @returns {*}
 */
HttpClient.prototype.doRequest = function (index, path, cb) {
    var self = this;
    if (!self._host || index > self._host.length) {
        // 全部地址都尝试请求后才提示失败
        return cb(new Error('Http request failed! path: ' + path));
    }

    var url = self._host[index] + path;
    request(url, function (err, response, body) {
        if (err || response.statusCode != 200) {
            warn('One request failed! url: %s, err: %s', url, err ? err.stack : response);
            setTimeout(function () {
                // 1秒后使用下一个地址重试
                self.doRequest(index + 1, path, cb);
            }, 1000);
        } else {
            // 成功则解析并回调数据
            try {
                if (_.isString(body)) {
                    body = JSON.parse(body);
                }
            } catch (e) {
                cb(e);
            }
            cb(null, body);
        }
    });
};

/**
 * 执行 http 请求
 *
 * @param {string} path
 * @param {Function} cb
 */
HttpClient.prototype.request = function (path, cb) {
    this.doRequest(0, path, cb);
};

/**
 * 获取 zookeeper 信息
 *
 * @param {Function} cb
 */
HttpClient.prototype.getZkInfo = function (cb) {
    var self = this;
    self.request(ZOO_PATH.HOSTS, function (hostsErr, body) {
        if (hostsErr) {
            return cb(hostsErr);
        }
        //var zooHosts = body.value;
        var zooHosts = '192.168.7.7:2181';
        // {"status":1,"message":"","value":"10.82.2.84:4180,10.82.2.84:4181,10.82.2.84:4182"}

        self.request(ZOO_PATH.PREFIX, function (prefixErr, body) {
            if (prefixErr) {
                return cb(prefixErr);
            }
            var zooPrefix = body.value;
            cb(null, zooHosts, zooPrefix);
        });
    });
};

/**
 * 下载配置文件
 *
 * @param {Function} cb
 */
HttpClient.prototype.getConfigFile = function (cb) {
    this.request(CONFIG_PATH.FILE, cb);
};

/**
 * 获取配置项
 *
 * @param {Function} cb
 */
HttpClient.prototype.getConfigItem = function (cb) {
    this.request(CONFIG_PATH.ITEM, cb);
};


/**
 * 导出
 *
 * @type {Function}
 */
module.exports = HttpClient;
