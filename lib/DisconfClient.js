/**
 * Created by Corey600 on 2016/8/1.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');
var properties = require('properties');
var debug = require('debug');

var HttpClient = require('./HttpClient');
var ZkClient = require('./ZkClient');

var info = debug('node-disconf-client:info');

/**
 * 构造函数
 *
 * @constructor
 */
function DisconfClient() {
    var defaultPath = path.join( process.cwd(), 'config');
    // 客户端配置文件路径，文件内容为 this._option 的配置内容
    this._file = {
        path: defaultPath,
        name: 'disconf.properties'
    };
    // 客户端配置默认值
    this._option = {
        // 是否使用远程配置文件
        // true(默认)会从远程获取配置 false则直接获取本地配置
        enable_remote: true,

        // 获取的配置文件写入的目标文件路径
        dist_file: path.join(defaultPath, 'remote.properties'),

        // 配置服务器的 HOST,用逗号分隔  127.0.0.1:8000,127.0.0.1:8000
        conf_server_host: '127.0.0.1:8000',

        // 版本, 请采用 X_X_X_X 格式
        version: '1_0_0',

        // APP 请采用 产品线_服务名 格式
        app: 'node_demo',

        // 环境
        env: 'test',

        // debug
        debug: true,

        // 需要远程获取的配置文件，用逗号分隔
        conf_file_name: 'demo.properties,system.properties',

        // 需要远程获取的配置项，用逗号分隔
        conf_item_name: 'node_demo',

        // 获取远程配置 重试次数，默认是3次
        conf_server_url_retry_times: 3,

        // 获取远程配置 重试时休眠时间，默认是5秒
        conf_server_url_retry_sleep_seconds: 1,

        // zookeeper服务配置
        zookeeper: {
            //     sessionTimeout: conf.sessionTimeout,
            //     spinDelay: conf.spinDelay,
            //     retries: conf.retries
        }
    };
}

// 继承
util.inherits(DisconfClient, EventEmitter);

/**
 * 初始化
 *
 * @param file
 * @param option
 */
DisconfClient.prototype.init = function (file, option) {
    var self = this;
    file = file || {};
    this._file = _.defaults(file, this._file);

    var _path = path.join(file.path, file.name);
    info('The DisconfClient\'s option file path:' + _path);

    // get Disconf's config file
    if(!fs.existsSync(_path)){
        throw Error('The config file of Disconf is not exist. path: ' + _path);
    }
    var data = fs.readFileSync(_path, {});
    data = properties.parse(data.toString(), {namespaces: true, variables: true, sections: true});
    option = option || {};
    this._option = _.defaults(option, data, this._option);
    info('The DisconfClient\'s option content:' + JSON.stringify(option));

    // get zookeeper info
    var httpClient = new HttpClient(option['conf_server_host']);
    httpClient.getZkInfo(function (error, host, prefix) {
        if(error){
            self.emit('error', error);
            return;
        }
        var zkClient = new ZkClient(host, prefix, option);
        zkClient.nodeWatch(function (err, data) {
            info(err, data);
        });
    });
};


/**
 * Utilities are under the util namespace
 */
var _util = DisconfClient.prototype.util = {};

/**
 * Reload 'config' module
 *
 * @returns {Config}
 */
_util.reloadConfig = function() {
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
 * 导出
 *
 * @type {Function}
 */
module.exports = DisconfClient;
