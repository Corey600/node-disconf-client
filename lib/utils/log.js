/**
 * Created by Corey600 on 2016/8/10.
 */

'use strict';

var debug = require('debug');

/**
 * prefix string.
 *
 * @type {string}
 */
var PREFIX = 'Disconf';

/**
 * get log instance.
 *
 * @param {string} tag
 * @returns {{info: Function, warn: Function, error: Function}}
 */
module.exports = function (tag) {
    return {
        info: debug(PREFIX + ':info [@' + tag + ']'),
        warn: debug(PREFIX + ':warn [@' + tag + ']'),
        error: debug(PREFIX + ':error [@' + tag + ']')
    }
};
