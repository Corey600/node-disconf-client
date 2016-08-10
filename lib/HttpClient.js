/**
 * Created by Corey600 on 2016/8/2.
 */

'use strict';

var util = require('util');
var _ = require('lodash');
var request = require('request');
var log = require('./utils/log')('HttpClient');

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
 * @param option
 * {
 *  conf_server_url_retry_times: string, // 重试次数
 *  conf_server_url_retry_sleep_seconds: string // 重试间隔时间
 *  conf_server_host: string // 配置服务器的HOST，用逗号分隔
 * }
 * @constructor
 */
function HttpClient(option) {
    this._app = option.app;
    this._version = option.version;
    this._env = option.env;
    this._retryTimes = option.conf_server_url_retry_times;
    this._retrySleepSeconds = option.conf_server_url_retry_sleep_seconds;
    var hosts = option.conf_server_host || '';
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
 * @param {number} retryTimes
 * @param {string} path
 * @param {Function} cb
 * @returns {*}
 */
HttpClient.prototype.doRequest = function (index, retryTimes, path, cb) {
    var self = this;
    if (!self._host || index >= self._host.length) {
        // 全部地址都尝试请求后才提示失败
        return cb(new Error('Http request failed! path: ' + path));
    }

    var url = self._host[index] + path;
    request(url, function (err, response, body) {
        if (err || response.statusCode != 200) {
            log.warn('One request failed! url: %s, err: %s', url, err ? err.stack : response);
            setTimeout(function () {
                if (retryTimes < self._retryTimes) {
                    self.doRequest(index, retryTimes + 1, path, cb);
                } else {
                    self.doRequest(index + 1, 0, path, cb);
                }
            }, self._retrySleepSeconds * 1000);
        } else {
            // 成功则解析并回调数据
            try {
                if (_.isString(body)) {
                    body = JSON.parse(body);
                }
            } catch (e) {
                log.warn('parse request body failed. path: %s, body: %s', path, body);
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
    this.doRequest(0, 0, path, cb);
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
        var zooHosts = body.value;
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
 * 获取配置
 *
 * @param {string} type
 * @param {string} name
 * @param {Function} cb
 */
HttpClient.prototype.getConfig = function (type, name, cb) {
    var _path = '';
    if(type === 'item'){
        // item
        _path += (CONFIG_PATH.ITEM + '?');
    }else{
        // file
        _path = (CONFIG_PATH.FILE + '?');
    }
    _path += ('app=' + this._app + '&');
    _path += ('version=' + this._version + '&');
    _path += ('env=' + this._env + '&');
    _path += ('key=' + name);
    this.request(_path, cb);
};

/**
 * 导出
 *
 * @type {Function}
 */
module.exports = HttpClient;
