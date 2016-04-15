/*
只有一个端口
 */
const net = require('net');
const http = require('http');
var fs=require('fs');
//http://172.20.1.25:7001/defaultroot/login.jsp
//srv config
var tunnelPortA = 18080;
//client config
var mirrorSrvHost = "quarkcomm.duapp.com";
var realServ = {
	host : '172.20.1.25',
	port : 7001
}
function showObj(a) {
	var b = {};
	showLog("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
	for (var i in a) {
		var v = a[i];
		var t = typeof v;
		if (t == 'function') {
			showLog(i + ":");
			continue;
		}
		b[i] = v;
		showLog(i + ":" + v);
	}
	showLog(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
};
var fn="/home/bae/log/nodejs.log";
//fs.writeFileSync(fn, "",{flag:'w'})
function showLog(a) {
	fs.writeFileSync(fn, a+"\n",{flag:'a'})
	console.log("" + a);
}

function oneportHttpProto() {
	/*原型
	服务端使用http尝试失败！
	因为http服务默认为一次收发，不是连续的
	 */
	var client = null;
	var mirror = http.createServer(function (req, res) {
			var ul = req.url;
			if (ul.startsWith("/guanlikey")) {
				showLog("guanlikey");
				client = [req.socket, res.socket];
			} else {
				var to = req.headers.host;
				showLog(req.headers.host);
				if (client) {
					var qsok = req.socket;
					var psok = res.socket;
					//showObj(sok);
					client[0].on("data", function (data) {
						showLog("req " + data);
						psok.write(data);
					});
					qsok.pipe(client[1]);
					//client[0].pipe(psok);
				}
			}
		});
	mirror.on("connection", function (socket) {
		socket.on("data", function (chunk) {
			showLog("client :" + chunk);
		});
	});
	//showObj(http);
	mirror.listen(tunnelPortA, '0.0.0.0');
	var cli = net.createConnection({
			host : mirrorSrvHost,
			port : tunnelPortA
		}, function () {
			//cli.write("sfsdfsdfsdfsdf");//这样不行，会断开连接
			cli.write("GET /guanlikey HTTP/1.1\r\n"
				 + 'Connection: close\r\n'
				 + '\r\n');

		});
	cli.on("data", function (data) {
		showLog(data);
	});
	cli.setTimeout(150000, function () {
		showLog("cli timeout ");
		cli.end();
	});
	cli.on('error', function (err) {
		showLog('cli error ' + err);
		console.trace(err);
		cli.end();
	});
	cli.on('end', function () {
		showLog('disconnected from server');
	});
}
function oneportNetProto() {
	/*原型
	服务端使用http尝试失败！
	 */
	//showLog(http.Server);
	var client = {};
	var mirror = net.createServer(function (c) {
			var start = true;
			/*if(start || client){
			var req=http.IncomingMessage(c);
			showObj(req);
			return;
			}*/
			c.on("data", function (chunk) {
				showLog("data=" + chunk);
				if (start) {
					showLog("first start");
					start = false;
					if (("" + chunk).startsWith("CLIENTREG:")) {
						c.write("you is client");
						showLog("first start get client");
						var key = ("" + chunk).substring("CLIENTREG:".length);
						client[key] = c;
					} else {
						showLog("first start not client");
						var htp = "" + chunk;
						var htps = htp.split("\r\n")
							var host = "";
						for (var i = 0; i < htps.length; i++) {
							var one = htps[i];
							if (one.startsWith("Host:")) {
								host = one.substring(5).trim();
								showLog(host);
								break;
							}
						}

						if (host != "" && client[host]) {
							showLog("bind client");
							client[host].write(chunk);
							client[host].pipe(c);
							c.pipe(client[host])
						}
					}
				}
				//a.write(chunk);
			});
		});

	//showObj(http);
	mirror.listen(tunnelPortA, '0.0.0.0');

	var cli = net.createConnection({
			host : mirrorSrvHost,
			port : tunnelPortA
		}, function () {
			cli.write("CLIENTREG:www.localhost.com:8125");
			return;
		});
	cli.on("data", function (data) {
		showLog("clidata=" + data);
	});
	cli.setTimeout(150000, function () {
		showLog("cli timeout ");
		cli.end();
	});
	cli.on('error', function (err) {
		showLog('cli error ' + err);
		console.trace(err);
		cli.end();
	});
	cli.on('end', function () {
		showLog('disconnected from server');
	});
}
//oneportNetProto();

/*
测试一个socket多个http请求
*/
function testMultiHttpInASocket(){
	var srvSocket=net.connect(7001, "172.20.1.25",
		function () {
		console.log("net connect");

		srvSocket.write("GET /defaultroot/login.jsp HTTP/1.1\r\n"
			 + 'Host: 172.20.1.25:7001\r\n'
			 + 'Connection: close\r\n'
			 + '\r\n');
		srvSocket.on("data",function(chunk){
			showLog(chunk);
		});
		
		setTimeout(function(){
			srvSocket.write("GET /defaultroot/login.jsp HTTP/1.1\r\n"
			 + 'Host: 172.20.1.25:7001\r\n'
			 + 'Connection: close\r\n'
			 + '\r\n');
		},1000);
		//res.end();
	});
}
//testMultiHttpInASocket();
/**
tunnel
通道
A、B两个数组表示现有需要匹配的socket
用于服务
 */
function Tunnel() {
	//?
	this.A = [];
	this.B = [];

};
Tunnel.prototype.putOne = function (A, list) {
	list.push(A);
	this.makeTunnel();
};
Tunnel.prototype.delOne = function (A, list) {
	var aw = list.indexOf(A);
	if (aw < 0) {
		showLog("no client in list");
		return list;
	};
	showLog("delete client in list");
	return list.slice(0, aw).concat(list.slice(aw + 1));
};
Tunnel.prototype.putA = function (A) {
	var self = this;
	A.on("end", function () {
		self.delA(A);
		showLog("SerB:client connect once end");
	});
	this.putOne(A, this.A);
};
Tunnel.prototype.delA = function (A) {
	this.A = this.delOne(A, this.A);
};
Tunnel.prototype.delB = function (B) {
	this.B = this.delOne(B, this.B);
};
Tunnel.prototype.putB = function (B) {
	var self = this;
	B.on("end", function () {
		self.delB(B);
		showLog("SerB:client connect once end");
	});
	this.putOne(B, this.B);
};
Tunnel.prototype.makeTunnel = function () {
	var ln = this.A.length < this.B.length ? this.A.length : this.B.length;
	showLog("try to find tunnel "+ln+" "+this.A.length+" "+this.B.length);
	if (ln > 0) {
		for (var i = 0; i < ln; i++) {
			showLog("trigger tunnel");
			var a = this.A[i];
			var b = this.B[i];
			if (a && b) {
				//匹配建立通道
				showLog("make tunnel,pool data="+a.poolData);
				if (a.poolData) {
					b.write(a.poolData);
				}
				if (b.poolData) {
					a.write(b.poolData);
				}
				a.pipe(b);
				b.pipe(a);

				/*b.on("data",function(chunk){
				a.write(chunk);
				});*/
			}
		}
		this.A = this.A.slice(ln);
		this.B = this.B.slice(ln);
		return;
	}
	showLog("no trigger tunnel");
};

var TunnelPool = {}

var clientStartKey = "CLIENTREG:";
var clientStartKeyLn = clientStartKey.length;
var HostHeadKey = "Host:";
var HostHeadKeyLn = HostHeadKey.length;
/**
server
mirror服务监听两个端口
A端口收到请求后通过B端口建立的连接将请求发出
 */
function SERVER() {
	var self = this;
	var pool = {};
	function getTunnel(key) {
		if (!pool[key]) {
			showLog("no Tunnel,create "+key);
			pool[key] = new Tunnel();
		}
		return pool[key];
	}

	var mirror = net.createServer(function (c) {
			c.setKeepAlive(true,30000);
			var start = true;
			c.on("error", function (e) {
				showLog(" server connect error "+e);
				console.trace(e);
			});
			c.on("data", function (chunk) {
				showLog("start=" + start/*+ ";data=" + chunk*/);
				if (start) {
					showLog("first start");
					start = false;
					var data = "" + chunk;
					if (data.startsWith(clientStartKey)) {
						//c.write("you is client");
						showLog("first start get client");
						var key = data.substring(clientStartKeyLn);
						showLog("====>"+key+"<====");
						getTunnel(key).putB(c);
					} else {
						showLog("first start not client");
						var htps = data.split("\r\n")
							var host = "";
						for (var i = 0; i < htps.length; i++) {
							var one = htps[i];
							if (one.startsWith(HostHeadKey)) {
								host = one.substring(HostHeadKeyLn).trim();
								host = host.split(":")[0].trim();
								showLog("====="+host+"=====");
								break;
							}
						}

						if (host != "") {
							c.poolData = chunk;
							getTunnel(host).putA(c);
							//showLog("bind client");
							/*client[host].write(chunk);
							client[host].pipe(c);
							c.pipe(client[host])*/
						}
					}
				}
			});
		});

	//showObj(http);
	mirror.listen(tunnelPortA, '0.0.0.0');
	return mirror;
}

/**
client
代理
主动与mirror服务保持连接
 */
function CLIENT() {
	this.Cnum = 0;
	this.Cmax = 10;
	this.checkNum = function () {
		if (this.Cnum > this.Cmax) {
			return false;
		}
		return true;
	};
	this.makeOneClient = function () {
		showLog("makeOneClient start");
		var self = this;
		self.Cnum = self.Cnum + 1;
		/*
		问题是firefox返回页面后页面不自动跳转
		*/
		function linkToRealServ() {
			if(cli && cli.readable){}else{
				showLog("cli cant read ");
				return;
			}
			var serv = net.createConnection(realServ, function () {
					showLog(' connected to real server!');
					//这是关键，建立通道
					serv.pipe(cli);
					serv.pipeTarget=cli;
					cli.pipe(serv);
					cli.pipeTarget=serv;
				});
			//serv.setKeepAlive(true,30000);
			serv.setTimeout(150000, function () {
				showLog("cli timeout ");
				serv.end();
			});
			serv.on('error', function (err) {
				//self.Cnum = self.Cnum - 1;
				showLog('real server error ' + err);
				serv.end();
			});
			serv.on('end', function () {
				showLog('disconnected from real server');
				linkToRealServ() ;
			});
		}
		
		var cli = net.createConnection({
				host : mirrorSrvHost,
				port : tunnelPortA
			}, function () {
				cli.write(clientStartKey+"www.localhost.com");
				showLog(self.Cnum + ' connected to server!');
				linkToRealServ();
			});
		//cli.setKeepAlive(true,30000);
		cli.setTimeout(150000, function () {
			showLog("cli timeout ");
			cli.end();
		});
		cli.on('error', function (err) {
			showLog('cli error ' + err);
			console.trace(err);
			cli.end();
		});
		cli.on('end', function () {
			self.Cnum = self.Cnum - 1;
			if(cli.pipeTarget){
				cli.pipeTarget.end();
			}
			showLog('disconnected from server');
		});
	};
	this.makeClient = function () {
		showLog("makeClient start");
		var self = this;

		if (this.checkNum()) {
			this.makeOneClient();
			this.makeClient();
		} else {
			setTimeout(function () {
				self.makeClient();
			}, 1000);
		}

	};
}

function testBrow() {
	//showLog("start");
	var server = SERVER();
	//showLog("start");
	//var client = new CLIENT();
	//showLog("start");
	//client.makeClient();
}
testBrow();
