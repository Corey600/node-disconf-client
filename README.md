# node-disconf-client

A Javascript module for
[Node.js](http://nodejs.org)
to connect
[Disconf](https://github.com/knightliao/disconf)
service.

### todo list

[] 启动时从disconf服务远程获取配置并写入配置文件，以config模块要求的规则命名{full_hostname}.EXT
[] 监控zookeeper节点，实时将远程配置文件修改同步到本地磁盘文件，提供远程配置修改事件供外部监听
[] 建立临时zookeeper节点，上传配置至远程服务器进行校验
[] 只在磁盘上更新配置文件，不修改config模块加载的内容，需要另外重新加载config模块以更新磁盘上配置文件的修改
[] 可在pm2启动时监听配置文件夹，配置文件被修改时重启服务。以实现远程修改配置文件，服务自动重启


配置： 自身的配置文件路径，下载的配置写入文件的路径
