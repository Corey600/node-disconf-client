/**
 * Created by Corey600 on 2016/8/1.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');
var zookeeper = require('node-zookeeper-client');
var properties = require('properties');

var HttpClient = require('./lib/HttpClient');
var ConfNode = require('./lib/ConfNode');
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
    var defaultPath = path.join(process.cwd(), 'config');

    // 客户端配置文件路径，文件内容为 this._option 的配置内容
    this._file = {
        path: defaultPath,
        name: 'disconf.properties'
    };

    // 客户端配置默认值
    this._option = {

        /*----- 区别java客户端特有的配置 -----*/

        // 获取的配置写入的目标文件路径
        dist_file: path.join(defaultPath, 'remote.properties'),

        // 需要远程获取的配置文件，用逗号分隔
        conf_file_name: 'demo.properties,system.properties',

        // 需要远程获取的配置项，用逗号分隔
        conf_item_name: 'node_demo',

        /*----- 以下配置同java客户端一致 -----*/

        // 是否使用远程配置文件
        // true(默认)会从远程获取配置 false则直接获取本地配置
        enable_remote: false,

        // 配置服务器的 HOST,用逗号分隔  127.0.0.1:8000,127.0.0.1:8000
        conf_server_host: '',

        // APP 请采用 产品线_服务名 格式
        app: '',

        // 版本, 请采用 X_X_X_X 格式
        version: 'DEFAULT_VERSION',

        // 部署环境
        env: 'DEFAULT_ENV',

        // debug
        debug: true,

        // 忽略哪些分布式配置，用逗号分隔
        ignore: 'demo.properties',

        // 获取远程配置 重试次数，默认是3次
        conf_server_url_retry_times: 3,

        // 获取远程配置 重试时休眠时间，默认是5秒
        conf_server_url_retry_sleep_seconds: 5,

        // 用户定义的下载文件夹, 远程文件下载后会放在这里。注意，此文件夹必须有有权限，否则无法下载到这里
        user_define_download_dir: path.join(defaultPath, 'download')
    };
}

util.inherits(DisconfClient, EventEmitter);

/**
 * Initialize the instance.
 *
 * @param file
 * @param option
 * @param cb
 */
DisconfClient.prototype.init = function (file, option, cb) {
    var self = this;
    if (!cb || !_.isFunction(cb)) cb = function () {
    };
    file = file || {};
    this._file = _.defaults(file, this._file);

    var _path = path.join(file.path, file.name);
    log.info('The DisconfClient\'s option file path: ' + _path);

    // If the DisconfClient\'s option file is exist.
    fs.access(_path, fs.F_OK, function (err) {
        if (!err) {
            // Read DisconfClient\'s option file.
            fs.readFile(_path, function (err, data) {
                if (err) return cb(err);
                data = properties.parse(data.toString(), {namespaces: true, variables: true, sections: true});
                option = option || {};
                self._option = _.defaults(option, data, self._option);
                log.info('the DisconfClient\'s option content: ' + JSON.stringify(option));
                self.getZkInfo(cb);
            });
        } else {
            log.warn('the DisconfClient\'s option file is not exist. err: ', err.stack);
            self.getZkInfo(cb);
        }
    });
};

/**
 * Get zookeeper server info.
 *
 * @param cb
 */
DisconfClient.prototype.getZkInfo = function (cb) {
    var self = this;
    var http = self._http = new HttpClient(self._option);
    http.getZkInfo(function (err, host, prefix) {
        if (err) {
            cb(err);
        } else {
            try {
                log.info('zk host: %s, prefix: %s', host, prefix);
                var zk = self._zk = zookeeper.createClient(host, {
                    sessionTimeout: ZK_SESSION_TIMEOUT,
                    spinDelay: ZK_SPIN_DELAY,
                    retries: ZK_RETRIES
                });
                zk.connect();
                self.initConfigNodes(prefix);
                cb(null, zk);
            } catch (err) {
                cb(err);
            }
        }
    });
};

/**
 * Initialize the config file/item nodes.
 *
 * @param {string} prefix
 * @returns {DisconfClient}
 */
DisconfClient.prototype.initConfigNodes = function (prefix) {
    var self = this;

    // get the ignore config list
    var ignores = self._option.ignore;
    if (!_.isNil(ignores) || _.isString(ignores)) {
        ignores = ignores.split(',');
    } else {
        ignores = [];
    }

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

    var readyNum = 0;
    var allConfig = {};
    nodeList.forEach(function (node) {
        node.nodeWatch(function (event, data) {
            log.info('zookeeper event: ', event, data);
            var _data = _.cloneDeep(data);
            _.defaultsDeep(_data, allConfig);
            allConfig = _data;
            fs.writeFile(self._option.dist_file, properties.stringify(_data), function (err) {
                if (err) return self.emit('err', err);
                self.emit('change', event, { key: node.name, data: data });
            });
        }, function (err, data) {
            readyNum++;
            if (err) return self.emit('error', err);
            var _data = _.cloneDeep(data);
            _.defaultsDeep(_data, allConfig);
            allConfig = _data;
            if (readyNum >= nodeList.length) {
                fs.writeFile(self._option.dist_file, properties.stringify(_data), function (err) {
                    if (err) return self.emit('err', err);
                    self.emit('ready', _data);
                });
            }
        });
    });

    return self;
};


/**
 * Utilities are under the util namespace.
 */
var _util = DisconfClient.prototype.util = {};

/**
 * Reload 'config' module.
 *
 * @returns {Config}
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
