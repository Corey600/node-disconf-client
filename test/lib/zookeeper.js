/**
 * Created by Corey600 on 2016/6/18.
 */

'use strict';

function MyZookeeper() {
}

MyZookeeper.prototype.connect = function(){
};

MyZookeeper.prototype.exists = function(path, cb){
    setTimeout(function(){
        cb && cb(false, true);
    }, 10);
};

MyZookeeper.prototype.create = function(path, data, mode, cb){
    setTimeout(function(){
        cb && cb(false, path);
    }, 10);
};

MyZookeeper.prototype.mkdirp = function(path, data, mode, cb){
    setTimeout(function(){
        cb && cb(false, path);
    }, 10);
};

MyZookeeper.prototype.setData = function(path, data, cb){
    setTimeout(function(){
        cb && cb(false, true);
    }, 10);
};

MyZookeeper.prototype.getData = function(path, watch, cb){
    setTimeout(function(){
        //watch && watch('test change');
        cb && cb(false);
    }, 10);
};

module.exports = MyZookeeper;
