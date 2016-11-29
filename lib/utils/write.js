/**
 * Created by Corey600 on 2016/8/11.
 */

'use strict';

var fs = require('fs');
var path = require('path');

/**
 * 递归创建目录
 *
 * @param {string} dirpath
 * @param {number|null} mode
 * @param {Function} callback
 * @private
 */
var _mkdir = function (dirpath, mode, callback) {
    fs.access(dirpath, fs.F_OK, function (err) {
        if (err) {
            var parent = path.dirname(dirpath);
            _mkdir(parent, mode, function (/*err*/) {
                // 忽略错误，如果错误真的影响文件的创建，会在文件写时抛出错误
                // if (err) return callback(err);
                fs.mkdir(dirpath, mode, callback);
            });
        } else {
            callback(null);
        }
    });
};

/**
 * 写入并覆盖到文件，如果目录不存在则创建
 *
 * @param {string} filepath
 * @param {*} data
 * @param {Function} callback
 * @public
 */
module.exports = function (filepath, data, callback) {
    //noinspection JSUnusedLocalSymbols
    _mkdir(path.dirname(filepath), null, function (err) {
        // 忽略错误，如果错误真的影响文件的创建，会在文件写时抛出错误
        // if (err) return callback(err);
        fs.writeFile(filepath, data, function (err) {
            if (err) return callback(err);
            callback(null, filepath);
        });
    });
};
