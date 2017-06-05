/**
 * Created by Corey600 on 2016/8/1.
 */

'use strict';

// modules to test
var disconf = require('../index');

// require core modules
var os = require('os');
var sysPath = require('path');

// require thirdpart modules
var zookeeper = require('node-zookeeper-client');
var request = require('request');
var expect = require('expect.js');
var mm = require('mm');

// require custom modules
var MyZookeeper = require('./lib/zookeeper');
var MyRequest = require('./lib/request');

// root dir
var rootDir = sysPath.dirname(sysPath.dirname(__filename));

// set env
var NODE_CONFIG_DIR = process.env.NODE_CONFIG_DIR = sysPath.join(rootDir, 'test/config');

// config dir of disconf
var configDir = sysPath.join(rootDir, 'config');

describe('test', function () {
    beforeEach(function (done) {
        mm(request, 'Request', MyRequest);
        mm(zookeeper, 'createClient', function(conn, opt){
            return new MyZookeeper(conn, opt);
        });
        done();
    });

    afterEach(function (done) {
        mm.restore();
        done();
    });

    describe('main', function () {

        before(function (done) {
            done();
        });

        after(function (done) {
            done();
        });

        it('excute success', function (done) {
            disconf.init({
                path: configDir,
                name: 'disconf.properties'
            }, {
                dist_file: sysPath.join(NODE_CONFIG_DIR, os.hostname() + '.properties'),
                user_define_download_dir: sysPath.join(NODE_CONFIG_DIR, 'download')
            }, function (err, zk) {
                expect(Boolean(err)).to.be(false);
                expect(zk).not.to.be(undefined);
            });

            disconf.on('error', function (err) {
                expect(Boolean(err)).not.to.be(false);
                done();
            });

            disconf.on('ready', function (data) {
                var conf = disconf.util.reloadConfig();
                expect(data).not.to.be(null);
                expect(conf).not.to.be(null);
                expect(data.a).to.be(1);
                expect(data.b).to.be(2);
                done();
            });
        });
    });
});
