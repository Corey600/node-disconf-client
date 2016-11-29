/**
 * Created by feichenxi on 2016/11/29.
 */

'use strict';

var url = require('url');
var _ = require('lodash');

function Request(options) {
    options = options || {};
    function callback() {
        var args = Array.prototype.slice.call(arguments);
        if(_.isFunction(options.callback))
            setTimeout(function(){
                options.callback.apply(this, args);
            }, 0);
    }
    function returnConf(key) {
        switch(key){
            case 'demo.properties':
                callback(false, {
                    statusCode: 200
                }, 'name=demo\nversion=v1.0.0\n');
                break;
            case 'test':
                callback(false, {
                    statusCode: 200
                }, 'hello');
                break;
            default:
                callback(new Error('config key is error!'));
                break;
        }
    }
    var data = url.parse(options.uri, true);
    switch (data.pathname){
        case '/api/zoo/hosts':
            callback(false, {
                statusCode: 200
            }, {
                status: 1,
                message: '',
                value: '127.0.0.1:4180,127.0.0.1:4181,127.0.0.1:4182'
            });
            break;
        case '/api/zoo/prefix':
            callback(false, {
                statusCode: 200
            }, {
                status: 1,
                message: '',
                value: '/disconf'
            });
            break;
        case '/api/config/file':
            returnConf(data.query.key);
            break;
        case '/api/config/item':
            returnConf(data.key);
            break;
        default:
            callback(new Error('uri is error!'));
            break;
    }
}

module.exports = Request;
