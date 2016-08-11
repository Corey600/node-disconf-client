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
var config = require('config');
var expect = require('expect.js');

describe('test', function () {
    beforeEach(function (done) {
        done();
    });

    afterEach(function (done) {
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
            process.env.NODE_CONFIG_DIR = './test/config';
            //noinspection JSCheckFunctionSignatures
            var configDir = (disconf.util.reloadConfig()).util.getEnv('NODE_CONFIG_DIR');
            //noinspection JSCheckFunctionSignatures
            disconf.init({
                path: configDir,
                filename: 'disconf.properties'
            }, {
                dist_file: sysPath.join(configDir, os.hostname() + '.properties'),
                user_define_download_dir: sysPath.join(configDir, 'download'),
                conf_file_name: '',
                conf_item_name: '',
                conf_server_host: '',
                app: 'DEFAULT_APP',
                version: 'DEFAULT_VERSION',
                env: 'DEFAULT_ENV',
                conf_server_url_retry_times: 0,
                conf_server_url_retry_sleep_seconds: 0
            }, function (err, zk) {
                expect(err).not.to.be(null);
                expect(zk).to.be(undefined);
                done();
            });
        });
    });
});
