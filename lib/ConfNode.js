/**
 * Created by Corey600 on 2016/8/9.
 */

'use strict';

var os = require('os');
var sysPath = require('path');
var uuid = require('node-uuid');
var zookeeper = require('node-zookeeper-client');
var properties = require('properties');
var write = require('./utils/write');
var log = require('./utils/log')('ConfigNode');

/**
 * 主机名称
 *
 * @type {string}
 */
var HOSTNAME = os.hostname();

/**
 * @param {string} type
 * @param {string} key
 * @param {string} prefix
 * @param {DisconfClient} client
 * @constructor
 */
function ConfigNode(type, key, prefix, client) {
    /**
     * 配置类型 'item' or 'file'.
     * @type {string}
     * @private
     */
    this._type = type;

    /**
     * 配置节点名称
     * @type {string}
     * @private
     */
    this._key = key;

    /**
     * http客户端
     * @type {HttpClient}
     * @private
     */
    this._http = client._http;

    /**
     * node-zookeeper-client 的实例
     * @type {*}
     * @private
     */
    this._zk = client._zk;

    /**
     * 选项
     * @type {*}
     * @private
     */
    this._option = client._option;

    /**
     * 配置（持久）节点的路径
     * @type {string}
     * @private
     */
    this._path = this._buildPath(prefix);

    /**
     * 创建临时节点传入的名称
     * @type {string}
     * @private
     */
    this._tempPath = this._path + '/' + HOSTNAME + '_' + process.pid + '_' + uuid.v4().replace(/-/g, '');

    /**
     * 临时节点创建之后真实的名称
     * @type {string|null}
     * @private
     */
    this._realPath = null;
}

/**
 * Build the path string.
 *
 * @param {string} prefix
 * @returns {string}
 * @private
 */
ConfigNode.prototype._buildPath = function (prefix) {
    var option = this._option;
    return (prefix
    + '/' + option.app + '_' + option.version + '_' + option.env
    + '/' + this._type + '/' + this._key);
};

/**
 * Get the key.
 *
 * @returns {string}
 * @public
 */
ConfigNode.prototype.getKey = function () {
    return this._key;
};

/**
 * Watch the event of configuration node.
 *
 * @param {Function} watcher
 * @param {Function} callback
 * @returns {ConfigNode}
 * @public
 */
ConfigNode.prototype.nodeWatch = function (watcher, callback) {
    var self = this;
    self._createPersistentNode(self._path, HOSTNAME, function (err, path) {
        if (err) return callback(err);
        self._doWatch(path, null, watcher, callback);
    });
    return this;
};

/**
 * Do watch the event of configuration node.
 *
 * @param {string} path
 * @param {Event} event
 * @param {Function} watcher
 * @param {Function} callback
 * @private
 */
ConfigNode.prototype._doWatch = function (path, event, watcher, callback) {
    var self = this;
    self._zk.getData(path,
        function (event) {
            self._doWatch(path, event, watcher, callback);
        },
        function (err/*, data, stat*/) {
            if (err) return callback(err);
            self._getData(function (err, data) {
                if(event){
                    watcher(err, event, data);
                }else{
                    callback(err, data);
                }
            });
        }
    );
};

/**
 * Get the configuration data from server.
 *
 * @param {Function} callback
 * @returns {ConfigNode}
 * @private
 */
ConfigNode.prototype._getData = function (callback) {
    var self = this;
    self._http.getConfig(self._type, self._key, function (err, data) {
        if (err) return callback(err);
        try {
            // to deal with the configuration item
            if (self._type === 'item') {
                data = data.value;
            }

            // save the configuration data to a file
            write(
                sysPath.join(self._option.user_define_download_dir, self._key),
                data,
                function (err) {
                    if (err) {
                        log.warn('save the configuration data to a file error. key: %s, error: %s', self._key, err.stack);
                    } else {
                        log.info('save the configuration data to a file success. key: %s', self._key);
                    }
                }
            );

            // parse the configuration data
            if (self._type === 'file') {
                // file
                data = properties.parse(data);
                self._pushData(JSON.stringify(data));
            } else {
                // item
                self._pushData(data);
                data = properties.parse(self._key + '=' + data);
            }
        } catch (e) {
            return callback(e);
        }
        return callback(null, data);
    });
    return this;
};

/**
 * Returns the configuration data for the server check.
 *
 * @param {*} data
 * @returns {ConfigNode}
 * @private
 */
ConfigNode.prototype._pushData = function (data) {
    var self = this;
    var ephemeralHandle = function (err, path) {
        if (err) {
            log.warn('create ephemeral node error. path: %s, error: %s', path, err.stack);
        } else {
            log.info('push config data success. path: %s', path);
        }
    };
    var _path = self._realPath;
    if (_path === null) {
        // 临时节点还未创建则创建
        self._createEphemeralNode(self._tempPath, data, ephemeralHandle);
        return this;
    }
    self._zk.exists(_path, function (err, stat) {
        if (err) {
            log.warn('push config data error. path: %s, error: %s', _path, err.stack);
            return;
        }
        if (stat) {
            self._zk.setData(
                _path,
                new Buffer(data),
                function (err, stat) {
                    if (err) {
                        log.warn('push config data error. path: %s, error: %s', _path, err.stack);
                    } else {
                        log.info('push config data success. stat: %s', JSON.stringify(stat));
                    }
                }
            );
        } else {
            // 临时节点还未创建则创建
            self._createEphemeralNode(self._tempPath, data, ephemeralHandle)
        }
    });
    return this;
};

/**
 * 创建持久节点，父路径不存在则会主动创建
 * 如果原本就存在则回调传入的路径，如果是新创建的则回调新创建的真实路径
 *
 * @param {string} path
 * @param {*} data
 * @param {Function} callback
 * @returns {ConfigNode}
 * @private
 */
ConfigNode.prototype._createPersistentNode = function (path, data, callback) {
    var self = this;
    self._zk.exists(path, function (err, stat) {
        if (!err && !stat) {
            log.info('persistent node does need to create. path: %s', path);
            self._zk.mkdirp(
                path,
                new Buffer(data),
                zookeeper.CreateMode.PERSISTENT,
                callback
            );
        } else {
            callback(err, path);
        }
    });
    return this;
};

/**
 * 创建临时节点，父路径不存在不会主动创建，而会抛错
 * 如果原本就存在则回调传入的路径，如果是新创建的则回调新创建的真实路径
 *
 * @param {string} path
 * @param {*} data
 * @param {Function} callback
 * @returns {ConfigNode}
 * @private
 */
ConfigNode.prototype._createEphemeralNode = function (path, data, callback) {
    var self = this;
    self._zk.exists(path, function (err, stat) {
        if (!err && !stat) {
            log.info('ephemeral node does need to create. path: %s', path);
            self._zk.create(
                path,
                new Buffer(data),
                zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL,
                function (errr, path) {
                    // 更新临时节点真实名称
                    self._realPath = path;
                    callback(err, path);
                }
            );
        } else {
            callback(err, path);
        }
    });
    return this;
};

/**
 * @type {Function}
 */
module.exports = ConfigNode;
