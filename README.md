# node-disconf-client

A Javascript module for
[Node.js](http://nodejs.org)
to connect
[Disconf](https://github.com/knightliao/disconf)
service.

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
    console.log('error ', err.stack);
});

// 准备事件，此时重新加载config模块，使配置生效
disconf.on('ready', function (data) {
    console.log('ready ', data);
    var conf = disconf.util.reloadConfig();
    console.log(conf);
});

// 配置在远程被修改，此时重新加载config模块，使配置生效
disconf.on('change', function (event) {
    console.log('change ', event);
    var conf = disconf.util.reloadConfig();
    console.log(conf);
});
```

### todo list

- [x] 启动时从disconf服务远程获取配置并写入配置文件，建议以config模块要求的规则命名{full_hostname}.EXT
- [x] 监控zookeeper节点，实时将远程配置文件修改同步到本地磁盘文件，提供远程配置修改事件供外部监听
- [x] 建立临时zookeeper节点，上传配置至远程服务器进行校验
- [x] 只在磁盘上更新配置文件，不修改config模块加载的内容，需要另外重新加载config模块以更新磁盘上配置文件的修改
- [x] 可在pm2启动时监听配置文件夹，配置文件被修改时重启服务。以实现远程修改配置文件，服务自动重启

### issue

- [x] 配置文件新增配置项，监听失效
- [ ] 配置项是中文，校验失败
