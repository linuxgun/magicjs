/*
通过net建立socket服务和连接，将http报文作为数据传输
并通过建立IP端口通道进行被动与主动代理功能
bowser-server-client-realserv
 */
const net = require('net');
const http = require('http');
//http://172.20.1.25:7001/defaultroot/login.jsp
//srv config
var tunnelPortA = 8125;
//all config
var tunnelPortB = 8126;
//client config
var mirrorSrvHost = "localhost";
var realServ = {
	host : '172.20.1.25',
	port : 7001
}

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
		console.log("no client in list");
		return list;
	};
	console.log("delete client in list");
	return list.slice(0, aw).concat(list.slice(aw + 1));
};
Tunnel.prototype.putA = function (A) {
	var self = this;
	A.on("end", function () {
		self.delA(A);
		console.log("SerB:client connect once end");
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
		console.log("SerB:client connect once end");
	});
	this.putOne(B, this.B);
};
Tunnel.prototype.makeTunnel = function () {
	var ln = this.A.length < this.B.length ? this.A.length : this.B.length;
	if (ln > 0) {
		for (var i = 0; i < ln; i++) {
			console.log("trigger tunnel");
			var a = this.A[i];
			var b = this.B[i];
			if (a && b) {
				//匹配建立通道
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
	console.log("no trigger tunnel");
};

/**
server
mirror服务监听两个端口
A端口收到请求后通过B端口建立的连接将请求发出
 */
function SERVER(portA, portB) {
	var self = this;
	this.tunnel = new Tunnel();
	this.A = net.createServer(function (c) {
			console.log("SerA:client connect once");
			self.tunnel.putA(c);
			c.on("error",function(){
				console.log("A server connect error");
			});
		});

	this.A.on("error", function () {
		console.log("A server error");
	});
	this.A.listen(portA, function () {
		console.log("SerA:server bound");
	});
	this.B = net.createServer(function (c) {
			console.log("SerB:client connect once");
			self.tunnel.putB(c);
			c.on("error",function(){
				console.log("B server connect error");
			});
			c.setKeepAlive(true,300000);		
		});
	
	this.B.on("error", function () {
		console.log("B server error");
	});
	this.B.listen(portB, function () {
		console.log("SerB:server bound");
	});
}

/**
client
代理
主动与mirror服务保持连接
 */
function CLIENT(portB, realServ) {
	this.Cnum = 0;
	this.Cmax = 10;
	this.checkNum = function () {
		if (this.Cnum > this.Cmax) {
			return false;
		}
		return true;
	};
	this.makeOneClient = function () {
		console.log("makeOneClient start");
		var self = this;
		self.Cnum = self.Cnum + 1;
		var cli = net.createConnection({
				host : mirrorSrvHost,
				port : portB
			}, function () {
				console.log(self.Cnum + ' connected to server!');
				var serv = net.createConnection(realServ, function () {
						console.log(' connected to real server!');
						//这是关键，建立通道
						serv.pipe(cli);
						cli.pipe(serv);
					});
				//serv.setKeepAlive(true,300000);
				serv.setTimeout(15000, function () {
					console.log("cli timeout ");
					serv.end();
				});
				serv.on('end', function () {
					console.log('disconnected from real server');
				});
				serv.on('error', function (err) {
					//self.Cnum = self.Cnum - 1;
					console.log('real server error ' + err);
					serv.end();
				});
			});
		//cli.setKeepAlive(true,300000);
		cli.setTimeout(15000, function () {
			console.log("cli timeout ");
			cli.end();
		});
		cli.on('error', function (err) {
			console.log('cli error ' + err);
			console.trace(err);
			cli.end();
		});
		cli.on('end', function () {
			self.Cnum = self.Cnum - 1;
			console.log('disconnected from server');
		});
	};
	this.makeClient = function () {
		console.log("makeClient start");
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
/*
测试服务模式
 */
/*
function testClient(port, name, append) {
var client = net.createConnection({
port : port
}, function () {
//'connect' listener
console.log(name + ' connected to server!');
client.write('world');
});
client.on('data', function (data) {
console.log(name + " get data:" + data.toString());
setTimeout(function () {
client.write(data.toString() + append);
}, 1000);
//client.end();
});
client.on('end', function () {
console.log('disconnected from server');
});
return client;
}

function testNode() {
var server = new SERVER(8125, 8126);
var client = testClient(8125, "one", "1");
var client = testClient(8126, "two", "2");
setTimeout(function () {
var client = testClient(8125, "three", "3");
var client = testClient(8126, "four", "4");
}, 3000);
setTimeout(function () {
var client = testClient(8125, "three", "5");
}, 6000);
setTimeout(function () {
var client = testClient(8126, "four", "6");
}, 9000);
}

function testBrow1() {
var server = new SERVER(8125, 8126);
function repeat() {
var client = testClient(8126, "two", "2");
client.on("end", function () {
repeat();
});
}
repeat();
}
 */
function testBrow() {
	console.log("start");
	var server = new SERVER(tunnelPortA, tunnelPortB);
	console.log("start");
	var client = new CLIENT(tunnelPortB, realServ);
	console.log("start");
	client.makeClient();
}
testBrow();
