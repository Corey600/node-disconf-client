/**
 * Created by Corey600 on 2016/8/2.
 */

'use strict';

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
 * @param {*} option
 * @constructor
 */
function HttpClient(option) {
    /**
     * APP
     * @type {string}
     * @private
     */
    this._app = option.app;

    /**
     * 版本
     * @type {string}
     * @private
     */
    this._version = option.version;

    /**
     * 部署环境
     * @type {string}
     * @private
     */
    this._env = option.env;

    /**
     * 重试次数
     * @type {number}
     * @private
     */
    this._retryTimes = option.conf_server_url_retry_times;

    /**
     * 重试间隔时间，单位 秒/s
     * @type {number}
     * @private
     */
    this._retrySleepSeconds = option.conf_server_url_retry_sleep_seconds;

    var hosts = option.conf_server_host || '';
    var list = _.isArray(hosts) ? hosts : hosts.split(','); // 传进来的字符串用逗号分隔多个地址
    /**
     * 配置服务器的 HOST 列表
     * @type {Array.<string>}
     * @private
     */
    this._host = list
        .filter(function (item) {
            return item != '';
        })
        .map(function (item) {
            if (item.indexOf(PROTOCOL) >= 0) {
                return item;
            }
            return PROTOCOL + item;
        });
}

/**
 * 发起 http 请求，如果失败则重试或尝试下一个地址
 *
 * @param {number} hostIndex
 * @param {number} retryTimes
 * @param {string} path
 * @param {Function} cb
 * @returns {HttpClient}
 * @private
 */
HttpClient.prototype._doRequest = function (hostIndex, retryTimes, path, cb) {
    var self = this;
    if (!self._host || hostIndex >= self._host.length) {
        // 全部地址都尝试请求后才提示失败，需保证异步化
        process.nextTick(function () {
            cb(new Error('Http request failed! path: ' + path));
        });
        return this;
    }

    var url = self._host[hostIndex] + path;
    request(url, function (err, response, body) {
        if (err || response.statusCode != 200) {
            log.warn('One request failed! url: %s, err/res: %s', url, err ? err.stack : response.statusCode);
            setTimeout(function () {
                if (retryTimes < self._retryTimes) {
                    self._doRequest(hostIndex, retryTimes + 1, path, cb);
                } else {
                    self._doRequest(hostIndex + 1, 0, path, cb);
                }
            }, self._retrySleepSeconds * 1000);
        } else {
            cb(null, body);
        }
    });
    return this;
};

/**
 * 执行 http 请求
 *
 * @param {string} path
 * @param {Function} cb
 * @returns {HttpClient}
 * @private
 */
HttpClient.prototype._request = function (path, cb) {
    return this._doRequest(0, 0, path, function (err, body) {
        if (err) return cb(err, body);
        // 成功则解析并回调数据
        try {
            if (_.isString(body)) {
                body = JSON.parse(body);
            }
        } catch (e) {
            // 解析出错就直接返回原始数据，这里不抛出错误，只打印提示
            log.info('parse request body is skipped. path: %s', path);
        }
        cb(null, body);
    });
};

/**
 * 执行 http 请求 文件，不对返回 body 进行解析
 *
 * @param {string} path
 * @param {Function} cb
 * @returns {HttpClient}
 * @private
 */
HttpClient.prototype._requestFile = function (path, cb) {
    return this._doRequest(0, 0, path, cb);
};

/**
 * 获取 zookeeper 信息
 *
 * @param {Function} cb
 * @returns {HttpClient}
 * @public
 */
HttpClient.prototype.getZkInfo = function (cb) {
    var self = this;
    self._request(ZOO_PATH.HOSTS, function (hostsErr, body) {
        if (hostsErr) {
            return cb(hostsErr);
        }
        var zooHosts = body.value;
        self._request(ZOO_PATH.PREFIX, function (prefixErr, body) {
            if (prefixErr) {
                return cb(prefixErr);
            }
            var zooPrefix = body.value;
            cb(null, zooHosts, zooPrefix);
        });
    });
    return this;
};

/**
 * 获取配置
 *
 * @param {string} type
 * @param {string} name
 * @param {Function} cb
 * @returns {HttpClient}
 * @public
 */
HttpClient.prototype.getConfig = function (type, name, cb) {
    var _path = (type === 'item' ? CONFIG_PATH.ITEM : CONFIG_PATH.FILE);
    _path += ('?app=' + this._app + '&');
    _path += ('version=' + this._version + '&');
    _path += ('env=' + this._env + '&');
    _path += ('key=' + name);
    if (type === 'file') {
        this._requestFile(_path, cb);
    } else {
        this._request(_path, cb);
    }
    return this;
};

/**
 * 导出
 *
 * @type {Function}
 */
module.exports = HttpClient;
