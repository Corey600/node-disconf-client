/**
 * Created by Corey600 on 2016/8/1.
 */

'use strict';

var fs = require('fs');
var sysPath = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');
var zookeeper = require('node-zookeeper-client');
var properties = require('properties');

var HttpClient = require('./lib/HttpClient');
var ConfNode = require('./lib/ConfNode');
var write = require('./lib/utils/write');
var log = require('./lib/utils/log')('index');

/**
 * Session timeout in milliseconds,
 * defaults to 10 seconds.
 *
 * @type {number}
 */
var ZK_SESSION_TIMEOUT = 10000;

/**
 * The delay (in milliseconds) between each connection attempts,
 * defaults to 20 seconds.
 *
 * @type {number}
 */
var ZK_SPIN_DELAY = 2000;

/**
 * The number of retry attempts for connection loss exception,
 * defaults to 3.
 *
 * @type {number}
 */
var ZK_RETRIES = 3;

/**
 * @constructor
 */
function DisconfClient() {
    var defaultPath = sysPath.join(process.cwd(), 'config');

    /**
     * 客户端配置文件路径，文件内容为 this._option 的配置内容
     * @type {{path, name: string}}
     * @private
     */
    this._file = {
        path: defaultPath,
        name: 'disconf.properties'
    };

    /**
     * 客户端配置默认值
     * @type {*}
     * @private
     */
    this._option = {

        /*----- 区别java客户端特有的配置 -----*/

        // 获取的配置写入的目标文件路径
        dist_file: sysPath.join(defaultPath, 'remote.properties'),

        // 需要远程获取的配置文件，用逗号分隔 test,demo.properties,system.properties
        conf_file_name: '',

        // 需要远程获取的配置项，用逗号分隔 test,demo.properties,system.properties
        conf_item_name: '',

        /*----- 以下配置同java客户端一致 -----*/

        // 是否使用远程配置文件
        // true(默认)会从远程获取配置 false则直接获取本地配置
        enable: {remote: {conf: true}},

        // 配置服务器的 HOST,用逗号分隔 127.0.0.1:8000,127.0.0.1:8000
        conf_server_host: '',

        // APP 请采用 产品线_服务名 格式
        app: 'DEFAULT_APP',

        // 版本, 请采用 X_X_X_X 格式
        version: 'DEFAULT_VERSION',

        // 部署环境
        env: 'DEFAULT_ENV',

        // debug
        debug: false,

        // 忽略哪些分布式配置，用逗号分隔
        ignore: '',

        // 获取远程配置 重试次数，默认是3次
        conf_server_url_retry_times: 3,

        // 获取远程配置 重试时休眠时间，默认是5秒
        conf_server_url_retry_sleep_seconds: 5,

        // 用户定义的下载文件夹, 远程文件下载后会放在这里。注意，此文件夹必须有有权限，否则无法下载到这里
        user_define_download_dir: sysPath.join(defaultPath, 'download')
    };

    /**
     * http 客户端实例
     * @type {HttpClient|null}
     * @private
     */
    this._http = null;

    /**
     * zookeeper 客户端实例
     * @type {*|null}
     * @private
     */
    this._zk = null;
}

util.inherits(DisconfClient, EventEmitter);

/**
 * Initialize the instance.
 *
 * @param {{path: string, name: string}} file
 * @param {*} option
 * @param {Function} callback
 * @returns {DisconfClient}
 * @public
 */
DisconfClient.prototype.init = function (file, option, callback) {
    var self = this;
    if (!callback || !_.isFunction(callback)) callback = function () {
    };
    file = file || {};
    this._file = _.defaults(file, this._file);

    var _path = sysPath.join(file.path, file.name);
    log.info('the DisconfClient\'s option file path: ' + _path);

    option = option || {};
    // If the DisconfClient\'s option file is exist.
    fs.access(_path, fs.F_OK, function (err) {
        if (!err) {
            // Read DisconfClient\'s option file.
            fs.readFile(_path, function (err, data) {
                if (err) return callback(err);
                try {
                    data = properties.parse(data.toString(), {namespaces: true, variables: true, sections: true});
                } catch (e) {
                    return callback(e);
                }
                self._option = _.defaults(option, data, self._option);
                log.info('the DisconfClient\'s option content: ' + JSON.stringify(self._option));
                self._getZkInfo(callback);
            });
        } else {
            log.warn('the DisconfClient\'s option file is not exist. err: ', err.stack);
            self._option = _.defaults(option, self._option);
            log.info('the DisconfClient\'s option content: ' + JSON.stringify(self._option));
            self._getZkInfo(callback);
        }
    });
    return this;
};

/**
 * Get zookeeper server info.
 *
 * @param {Function} callback
 * @returns {DisconfClient}
 * @private
 */
DisconfClient.prototype._getZkInfo = function (callback) {
    var self = this;
    var http = self._http = new HttpClient(self._option);
    http.getZkInfo(function (err, host, prefix) {
        if (err) return callback(err);
        try {
            log.info('zk host: %s, prefix: %s', host, prefix);
            var zk = self._zk = zookeeper.createClient(host, {
                sessionTimeout: ZK_SESSION_TIMEOUT,
                spinDelay: ZK_SPIN_DELAY,
                retries: ZK_RETRIES
            });
            zk.connect();
            if (self._option.enable.remote.conf) {
                // 远程配置开启
                self._initConfigNodes(prefix);
            } else {
                // 远程配置关闭，直接准备事件
                self.emit('ready', null);
            }
            callback(null, zk);
        } catch (e) {
            callback(e);
        }
    });
    return this;
};

/**
 * Initialize the config file/item nodes.
 *
 * @param {string} prefix
 * @returns {DisconfClient}
 * @private
 */
DisconfClient.prototype._initConfigNodes = function (prefix) {
    var self = this;

    // get the ignore config list
    var ignores = self._option.ignore;
    if (!_.isNil(ignores) && _.isString(ignores)) {
        ignores = ignores.split(',');
    } else {
        ignores = [];
    }

    // get ConfNode list
    var nodeList = [];
    var types = ['file', 'item'];
    types.forEach(function (type) {
        var names = self._option['conf_' + type + '_name'];
        if (_.isNil(names) || !_.isString(names)) {
            return;
        }
        var list = names.split(',');
        if (list.length <= 0) {
            return;
        }
        list.forEach(function (name) {
            if (name == '' || ignores.indexOf(name) >= 0) return;
            nodeList.push(new ConfNode(type, name, prefix, self));
        });
    });

    // watch every node
    var readyNum = 0;
    var allConfig = {};
    nodeList.forEach(function (node) {
        node.nodeWatch(function (err, event, data) {
            // 监听
            if (err) {
                log.error('zookeeper watch event error. event: %s, error: %', event.name, err.stack);
                self.emit('error', err);
                return;
            }
            allConfig = _.defaultsDeep(data, allConfig);
            write(self._option.dist_file, properties.stringify(allConfig), function (err) {
                if (err) {
                    log.error('write all config error. event: %s, error: %', event.name, err.stack);
                    self.emit('error', err);
                } else {
                    self.emit('change', event, {key: node.getKey(), data: data});
                }
            });
        }, function (err, data) {
            // 回调
            readyNum++;
            if (err) {
                self.emit('error', err);
                return;
            }
            allConfig = _.defaultsDeep(data, allConfig);
            if (readyNum >= nodeList.length) {
                write(self._option.dist_file, properties.stringify(allConfig), function (err) {
                    if (err) {
                        self.emit('error', err);
                    } else {
                        self.emit('ready', allConfig);
                    }
                });
            }
        });
    });
    return this;
};


/**
 * Utilities are under the util namespace.
 *
 * @type {*}
 * @public
 */
var _util = DisconfClient.prototype.util = {};

/**
 * Reload 'config' module.
 *
 * @returns {Config}
 * @public
 */
_util.reloadConfig = function () {
    var config = require('config');
    //noinspection JSCheckFunctionSignatures
    var dir = config.util.getEnv('NODE_CONFIG_DIR');
    for (var key in require.cache) {
        //noinspection JSUnfilteredForInLoop
        var fileName = key;
        //noinspection JSCheckFunctionSignatures
        if (-1 === fileName.indexOf(dir)) {
            continue;
        }
        delete require.cache[fileName];
    }
    delete require.cache[require.resolve('config')];
    return require('config');
};

/**
 * @type {DisconfClient}
 */
module.exports = new DisconfClient();
