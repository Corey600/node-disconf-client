/**
 * Created by Corey600 on 2016/8/9.
 */

'use strict';

var os = require('os');
var fs = require('fs');
var path = require('path');
var util = require('util');
var _ = require('lodash');
var uuid = require('node-uuid');
var zookeeper = require('node-zookeeper-client');
var properties = require('properties');
var log = require('./utils/log')('ConfigBase');

/**
 * @type {string}
 */
var HOSTNAME = os.hostname();

/**
 * @constructor
 */
function ConfigBase(type, key, prefix, client) {
    this._type = type;
    this._key = key;
    this._http = client._http;
    this._zk = client._zk;
    this._option = client._option;
    var path = this._path = this._buildPath(prefix);
    this._temp = path + '/' + HOSTNAME + '_' + process.pid + '_' + uuid.v4().replace(/-/g, '');
}

/**
 * Build the path string.
 *
 * @param prefix
 * @returns {string}
 * @private
 */
ConfigBase.prototype._buildPath = function (prefix) {
    var option = this._option;
    return (prefix
    + '/' + option.app + '_' + option.version + '_' + option.env
    + '/' + this._type + '/' + this._key);
};

/**
 * Watch the event of configuration node.
 *
 * @param watcher
 * @param cb
 */
ConfigBase.prototype.nodeWatch = function (watcher, cb) {
    var self = this;
    self.existsPath(function (err, path) {
        if (err) return cb(err);
        self._zk.getData(path,
            function (event) {
                self.getConfig(function (err, data) {
                    watcher(event, data);
                });
            },
            function (err, data, stat) {
                if (err) return cb(err);
                self.getConfig(cb);
            }
        );
    });
};

/**
 * Get the configuration data from server.
 *
 * @param {Function} cb
 */
ConfigBase.prototype.getConfig = function (cb) {
    var self = this;
    self._http.getConfig(self._type, self._key, function (err, data) {
        if (err) return cb(err);
        try {
            // to deal with the configuration item
            if (self._type === 'item') {
                data = data.value;
            }

            // save the configuration data to a file
            fs.writeFile(
                path.join(self._option.user_define_download_dir, self._key),
                data,
                function (err) {
                    if (err) {
                        log.warn('save the configuration data to a file error. key: %s, error: %s', self._key, err.stack);
                    }else{
                        log.info('save the configuration data to a file success. key: %s', self._key);
                    }
                }
            );

            // parse the configuration data
            if (self._type === 'file') {
                // file
                data = properties.parse(data);
                self.pushData(JSON.stringify(data));
            }else{
                // item
                self.pushData(data);
                data = properties.parse(self._key + '=' + data);
            }
        } catch (e) {
            return cb(e);
        }
        cb(null, data);
    });
};

/**
 * If path is not exist, create it.
 *
 * @param {Function} cb
 */
ConfigBase.prototype.existsPath = function (cb) {
    var self = this;
    var path = self._path;
    self._zk.exists(path, function (err, stat) {
        if (err)  return cb(err);
        if (stat) {
            cb(null, path);
        } else {
            log.warn('Node does not exist.To create node...');
            self._zk.mkdirp(
                path,
                new Buffer(HOSTNAME),
                zookeeper.CreateMode.PERSISTENT,
                function (err, path) {
                    if (err) return cb(err);
                    log.info('Node: %s is created.', path);
                    cb(null, path);
                }
            );
        }
    });
};

/**
 * Returns the configuration data for the server check.
 *
 * @param {{}} data
 */
ConfigBase.prototype.pushData = function (data) {
    var self = this;
    var _path = self._temp;
    self._zk.exists(_path, function (err, stat) {
        if (err) {
            log.warn('push config data error. path: %s, error: %s', _path, err.stack);
            return;
        }
        if (stat) {
            self._zk.setData(_path, new Buffer(data),
                function (err, stat) {
                    if (err) {
                        log.warn('push config data error. path: %s, error: %s', _path, err.stack);
                    }else{
                        log.info('push config data success. stat: %s', JSON.stringify(stat));
                    }
                }
            );
        } else {
            self._zk.create(_path, new Buffer(data),
                zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL,
                function (err, path) {
                    if (err) {
                        log.warn('push config data error. path: %s, error: %s', _path, err.stack);
                    }else{
                        log.info('push config data success. new path: %s', path);
                        self._temp = path;
                    }
                }
            );
        }
    });
};

/**
 * @type {Function}
 */
module.exports = ConfigBase;
