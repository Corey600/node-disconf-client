/**
 * Created by feichenxi on 2016/8/1.
 */

'use strict';

var config = require('config');
var path = require('path');
var fs = require('fs');

function reloadConfig() {
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
}

module.exports.init = function (option, cb) {
    //noinspection JSCheckFunctionSignatures
    var _option = {
        path: config.util.getEnv('NODE_CONFIG_DIR'),
        filename: 'disconf.properties',
        autoReloadConfig: true
    };
    config.util.extendDeep(_option, option);

    var _path = path.join(_option.path, _option.filename);
    fs.readFile(_path, {}, function (err, data) {
        console.log(data.toString());
        cb();
    })
};

module.exports.reloadConfig = function () {
    return reloadConfig();
};
