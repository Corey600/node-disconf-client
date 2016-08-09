/**
 * Created by Corey600 on 2016/8/2.
 */

'use strict';

var os = require('os');
var util = require('util');
var _ = require('lodash');
var uuid = require('node-uuid');
var zookeeper = require('node-zookeeper-client');
var debug = require('debug');

var info = debug('node-disconf-client:info');
var warn = debug('node-disconf-client:warn');
var error = debug('node-disconf-client:error');

/**
 * 主机名称
 *
 * @type {string}
 */
var HOSTNAME = os.hostname();

/**
 * 构造函数
 *
 * @param {*} zk
 * @param {string} prefix
 * @param {{app: string, version:string, env:string}} option
 * @constructor
 */
function ZkClient(zk, prefix, option) {
    this._zk = zk;
    this._path = prefix + '/' + option.app + '_' + option.version + '_' + option.env;
    this._temp = HOSTNAME + '_' + process.pid + '_' + uuid.v4().replace(/-/g, '');
}

ZkClient.prototype.nodeWatch = function (node, watcher, cb) {
    var self = this;
    var path = self._path + '/' + node.type + '/' + node.name;
    self.existsDir(path, function (err, path) {
        if(err) return cb(err);
        self.getData(path, watcher, cb);
    });
};

ZkClient.prototype.existsDir = function (path, cb) {
    var self = this;
    self._zk.exists(path, function (err, stat) {
        if (err)  return cb(err);
        if (stat) {
            cb(null, path);
        } else {
            warn('Node does not exist.To create node...');
            self._zk.mkdirp(
                path,
                new Buffer(HOSTNAME),
                zookeeper.CreateMode.PERSISTENT,
                function (err, path) {
                    if (err) return cb(err);
                    info('Node: %s is created.', path);
                    cb(null, path);
                }
            );
        }
    });
};

ZkClient.prototype.getData = function (path, watcher, cb) {
    this._zk.getData(
        path,
        function (event) {
            watcher(event);
        },
        function (err, data, stat) {
            if (err) return cb(err);
            info('Got data [%s]: %s', path, data.toString('utf8'));
            cb(null, {data: data, stat: stat});
        }
    );
};


ZkClient.prototype.pushData = function (path, data) {
    var self = this;
    self._zk.create(
        path+self._temp,
        new Buffer(data),
        zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL,
        function (err, path) {
            if (err) {
                error('existsNode' + err.stack);
                return;
            }
            info('Node: %s is created.', path);
        }
    );
};

/**
 * 导出
 *
 * @type {Function}
 */
module.exports = ZkClient;
