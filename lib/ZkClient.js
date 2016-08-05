/**
 * Created by Corey600 on 2016/8/2.
 */

'use strict';

var util = require('util');
var _ = require('lodash');
var debug = require('debug');
var zookeeper = require('node-zookeeper-client');

var info = debug('node-disconf-client:info');
var error = debug('node-disconf-client:error');

function ZkClient(host, prefix, option) {
    this._path = prefix + '/' + option.app + '_' + option.version + '_' + option.env;
    this._temp = 'hostname-' + Math.random();
    this._client = zookeeper.createClient(host, {});
    this._items = [];
    this.buildItems(prefix, option);
    this._client.connect();

    this._client.on('connected', function connect() {
        console.log('\x1b[32m%s\x1b[0m', 'zookeeper connected!');
    });

    this._client.on('disconnected', function connect() {
        console.log('\x1b[32m%s\x1b[0m', 'zookeeper disconnected!');
    });

    this._client.getChildren(this._path, function (error, children, stats) {
        if (error) {
            console.log(error.stack);
            return;
        }
        console.log('Children are: %j.', children);
    });
}

ZkClient.prototype.buildItems = function (prefix, option) {
    var types = ['file', 'item'];
    for(var i=0, ll = types.length;i<ll;i++){
        var type = types[i];
        var names = option['conf_'+type+'_name'];
        if(_.isNil(names) || !_.isString(names)){
            continue;
        }
        var list = names.split(',');
        if(list.length<=0){
            continue
        }
        for(var j=0;j<list.length;j++){
            var name = list[j];
            if(name == '') continue;
            this._items.push({
                type: type,
                name: name
            });
        }
    }
};

ZkClient.prototype.nodeWatch = function (cb) {
    var self = this;
    var items = self._items;
    if(!_.isArray(items) || items.length<=0){
        return;
    }
    for(var i=0, ll=items.length;i<ll;i++){
        var item = items[i];
        var path = this._path + '/' + item.type + '/' + item.name;
        self.existsDir(path, function (path) {
            self.getData(path, cb);
        });
    }
};

ZkClient.prototype.existsDir = function (path, cb) {
    var self = this;
    self._client.exists(path, function (err, stat) {
        if (err) {
            error(err.stack);
            return;
        }
        if (stat) {
            info('Node exists.');
            cb(path);
        } else {
            info('Node does not exist.');
            self._client.mkdirp(
                path,
                new Buffer('hello'),
                zookeeper.CreateMode.PERSISTENT,
                function (err, path) {
                    if (err) {
                        error('existsNode'+err.stack);
                        return;
                    }
                    info('Node: %s is created.', path);
                    cb(path);
                }
            );
        }
    });
};

ZkClient.prototype.getData = function (path, cb) {
    this._client.getData(
        path,
        function (event) {
            info('Got event [%s]: %s.', path, event);
        }
        ,
        function (err, data, stat) {
            if (err) {
                error('Got error [%s]: %s.', path);
                return cb(err);
            }
            console.log('Got data [%s]: %s', path, JSON.stringify(data));
        }
    );
};



ZkClient.prototype.pushData = function (path, data) {

};

/**
 * 导出
 *
 * @type {Function}
 */
module.exports = ZkClient;
