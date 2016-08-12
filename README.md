# node-disconf-client

[![Build Status](https://api.travis-ci.org/Corey600/node-disconf-client.svg)](http://travis-ci.org/Corey600/node-disconf-client)
[![Coverage Status](https://coveralls.io/repos/github/Corey600/node-disconf-client/badge.svg)](https://coveralls.io/github/Corey600/node-disconf-client)
[![NPM Downloads](https://img.shields.io/npm/dm/node-disconf-client.svg?style=flat)](https://www.npmjs.org/package/node-disconf-client)
[![NPM Version](http://img.shields.io/npm/v/node-disconf-client.svg?style=flat)](https://www.npmjs.org/package/node-disconf-client)
[![License](https://img.shields.io/npm/l/node-disconf-client.svg?style=flat)](https://www.npmjs.org/package/node-disconf-client)

A Javascript module for
[Node.js](http://nodejs.org)
to connect
[Disconf](https://github.com/knightliao/disconf)
service.

## Installation

You can install it using npm:

```bash
$ npm install node-disconf-client
```

## Example

```javascript
var os = require('os');
var path = require('path');
var disconf = require('node-disconf-client');
// 可以配合config模块使用
var config = require('config');

var configDir = config.util.getEnv('NODE_CONFIG_DIR');
disconf.init({
    // 配置disconf的本地配置文件路径
    path: configDir,
    filename: 'disconf.properties'
}, {
    // 配置远程下载的配置保存哪个文件（所有配置聚合后的文件）
    // 这里以 hostname 命名，使能被 config 模块读取
    dist_file: path.join(configDir, os.hostname() + '.properties'),
    // 配置远程下载的配置保存哪个目录（配置源文件）
    user_define_download_dir: path.join(configDir, 'download')
});

// 错误事件
disconf.on('error', function (err) {
    console.log('error:', err.stack);
});

// 准备事件，此时重新加载config模块，使配置生效
disconf.on('ready', function (data) {
    console.log('ready:', data);
    var conf = disconf.util.reloadConfig();
    console.log('conf:', conf);
});

// 配置在远程被修改，此时重新加载config模块，使配置生效
disconf.on('change', function (event, data) {
    console.log('change:', event.name, data);
    var conf = disconf.util.reloadConfig();
    console.log('conf:', conf);
});
```

## Documentation

### init(file[, option[, callback]])

This is the only external interface that executes instance initialization. The argument `file` can set the directory and file name of the _option_ file, that can configure the client itself. The argument `option` can set _option_ manually. Its priority is higher than the file. Part of _option_ with the same name is same as the Java client. You can refer Java [`Disconf-Client`](https://github.com/knightliao/disconf/wiki/%E9%85%8D%E7%BD%AE%E8%AF%B4%E6%98%8E).

*Arguments*

* file {*Object*} - The file of the _option_. Currently available options are:

    * `path` {*String*} - The directory path of _option_ file.
    * `filename` {*String*} - The name of _option_ file, defaults to `disconf.properties`.


* option {*Object*} - The client's own configuration file. Currently available options are:

    * `dist_file`: {*String*} - 获取的配置写入的目标文件路径.
    * `conf_file_name`: {*String*} - 需要远程获取的配置文件，用逗号分隔，例如： demo.properties,system.properties
    * `conf_item_name`: {*String*} - 需要远程获取的配置项，用逗号分隔，例如： test,demo

    _以下配置同 java 客户端一致:_
    * `enable: {remote: {conf: true}}`: {*Boolean*} - 是否使用远程配置文件,true(默认)会从远程获取配置 false则直接获取本地配置
    * `conf_server_host`: {*String*} - 配置服务器的 HOST，用逗号分隔 127.0.0.1:8000,127.0.0.1:8000
    * `app`: {*String*} - APP，请采用 产品线_服务名 格式
    * `version`: {*String*} - 版本，请采用 X_X_X_X 格式
    * `env`: {*String*} - 部署环境
    * `debug`: {*Boolean*} - 调试
    * `ignore`: {*String*} - 忽略哪些分布式配置，用逗号分隔
    * `conf_server_url_retry_times`: {*Number*} - 获取远程配置 重试次数，默认是3次
    * `conf_server_url_retry_sleep_seconds`: {*Number*} - 获取远程配置 重试时休眠时间，默认是5秒
    * `user_define_download_dir`: {*String*} - 用户定义的下载文件夹, 远程文件下载后会放在这里。注意，此文件夹必须有有权限，否则无法下载到这里


* callback(err, zk) {*Function*} - The callback function.

    * `err` {*Error*} - Error during initialization.
    * `zk` {*{}*} - The [node-zookeeper-client](https://github.com/alexguan/node-zookeeper-client) instance.

*Example*

```javascript
var disconf = require('node-disconf-client');
disconf.init({
    path: './config',
    filename: 'disconf.properties'
}, {
    dist_file: './config/remote.properties',
    user_define_download_dir: './config/download'),
    conf_item_name: 'demo',
    conf_server_host: '127.0.0.1:8000',
    app: 'DEFAULT_APP',
    version: 'DEFAULT_VERSION',
    env: 'DEFAULT_ENV',
});
```

----

### Event

Optionally, you can register watcher functions after calling
[`init`](#disconfinitfile-option-callback) methods.

#### `ready`

After the first time to downloaded all remote configuration, this event will be emit. It will return the data that contains all the configuration.

*Callback*

* data {*Object*} - All the configuration.

*Example*

```javascript
disconf.on('ready', function (data) {
    console.log('ready:', data);
});
```

#### `change`

At any time when remote configuration changes, this event will be emit. It will return the event and the data that contains all the configuration.

*Callback*

* event {*Event*} - It is a event instance form [node-zookeeper-client](https://github.com/alexguan/node-zookeeper-client#event).
* data {*Object*} - All the configuration after the update.

*Example*

```javascript
disconf.on('change', function (event, data) {
    console.log('change:', event.name, data);
});
```

#### `error`

At any time when a error appears, this event will be emit.

*Callback*

* err {*Error*} - Any possible error.

*Example*

```javascript
disconf.on('error', function (err) {
    console.log('error:', err.stack);
});
```

----

### Utility

It provides utility tools include in `util`.

#### reloadConfig(void)

This function can reload the [`config`](https://github.com/lorenwest/node-config) module, make the changes of the configuration files to take effect. The function returns the [`config`](https://github.com/lorenwest/node-config) instance. But you can still perform again `require` to get the [`config`](https://github.com/lorenwest/node-config) instance.

Before using this function you must have installed the [`config`](https://github.com/lorenwest/node-config) module. Such as like the following:

```
$ npm install config
```

*Example*

```javascript
var disconf = require('node-disconf-client');
var conf = disconf.util.reloadConfig();
```

----

### Todo list

- [x] 启动时从disconf服务远程获取配置并写入配置文件，建议以config模块要求的规则命名{full_hostname}.EXT
- [x] 监控zookeeper节点，实时将远程配置文件修改同步到本地磁盘文件，提供远程配置修改事件供外部监听
- [x] 建立临时zookeeper节点，上传配置至远程服务器进行校验
- [x] 只在磁盘上更新配置文件，不修改config模块加载的内容，需要另外重新加载config模块以更新磁盘上配置文件的修改
- [x] 可在pm2启动时监听配置文件夹，配置文件被修改时重启服务。以实现远程修改配置文件，服务自动重启
- [ ] 增加用例，完善单元测试

### Issue

- [ ] 配置项是中文，校验失败

## License

Licensed under the
[MIT](http://opensource.org/licenses/MIT)
license.
