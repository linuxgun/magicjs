/**
 * 条件触发模式一 每一组条件检查运行后再触发检查
 * 
 * 有个问题：无法进行多级继承 方案1： 在Object.prototype建立一个map进行管理 缺点是无法对不用的object进行清理， 造成内存资源占用
 * 方案2： 根据object的原型进行逐级触发 现在实现的就是这个
 */

(function() {
	// 触发条件设置
	Object.prototype.when = function(func) {
		// 这种判断利于有原型的对象避免从原型取次属性
		if (!this.hasOwnProperty('__cond__')) {
			this.__cond__ = [];
		}
		var me = this;
		return {
			scope : this,
			todo : function(list) {
				me.__cond__.push([ func, list ]);
			}
		}
	};
	// 得到上级原型，这个是用于兼容ie的
	Object.prototype._getProto=function(){
		// ie不兼容，通过create可以兼容
		if(this.__proto__){
			return this.__proto__;
		}
		// 这种方式应该是通用的
		if(this.constructor && this.constructor.prototype){
			return this.constructor.prototype
		}
		return null;
	};
	// 根据条件组进行检查
	Object.prototype._check = function() {
		if(!this.__cond__){
			return
		}
		var pre = this.__pre__;
		this.__pre__ = this.clone();
		var change = false;
		if(this.__cond__.length==0){
			console.log("这个对象条件数为0");
		}else{
			console.log("这个对象条件数为"+this.__cond__.length);
			for (var i = 0; i < this.__cond__.length; i++) {
				var func = this.__cond__[i][0];
				var todos = this.__cond__[i][1];
				if (func.call(this, pre, this)) {
					change = true;
					if ((typeof todos) == 'function') {
						todos.call(this, pre, this);
						continue;
					}
					for (var j = 0; j < todos.length; j++) {
						todos[j].call(this, pre, this);
					}
				}
			}
		}
		// 注意，如果中间某个原型没有__cond__则会造成不能深入到最后的原型
		// 当然也可用于截断check过程不再深入
		var proto=this._getProto();
		if(proto){
			proto._check();
		}
		if (change) {
			this._check();
		}
	};
	// 检查一个属性出现修改
	Object.prototype.attrChange=function(attr){
		if(!this.__pre__){
			return true;
		}
		if(this.__pre__[attr]!=undefined && this.__pre__[attr]!=this[attr]){
			return true
		}
		return false
	};
	// 克隆全对象，不只本身属性
	Object.prototype.clone = function(obj) {
		if(!obj){
			var obj = {};
		}
		for ( var i in this) {
			obj[i] = this[i];
		}
		return obj;
	};
	// 简单的做某个行为，或者只是触发check
	Object.prototype.todo = function(func) {
		if(func){
		this.__pre__ = this.clone();
		func.call(this);}
		this._check();
	};
	// 可根据object或者function直接产生，obj为产生的object赋值
	Object.prototype.create = function(obj) {
		var c;
		if(typeof this == 'function'){
			c=this;
		}else{
			c=function(){};
			// 不能使用c.prototype=this，否则将找不到constructor等信息
			this.clone(c.prototype);
		}
		
		var cc = new c();
		if (obj) {
			for ( var i in obj) {
				if (obj.hasOwnProperty(i)) {
					cc[i] = obj[i];
				}
			}
		}
		// 因为ie可能没有此属性
		if(!cc.__proto__){
			cc.__proto__=c.prototype;
		}
		cc.__pre__ = null;
		cc.__cond__=[];
		// TODO 考虑是否创建后直接check
		// cc._check();
		return cc;
	};
})();
function test() {
	var C = {
			a:'Ca',
		c : 9,
		fc : function() {
		}
	};
	C.when(function(pre, the) {
		if (this.c < 13) {
			// console.log("条件符合1");
			return true;
		}
		console.log("条件符合1->Fail");
	}).todo([ function() {
		console.log("条件符合1->" + this.c);
		this.c = this.c + 1;
	} ]);
	C.when(function(pre, the) {
		if (this.c < 40) {
			// console.log("条件符合2");
			return true;
		}
		console.log("条件符合2->Fail");
	}).todo(function() {
		console.log("条件符合2->" + this.c);
		console.log("this.a=" + this.a);
		this.c = this.c + 1;
	});
	C.when(function(pre, the) {
		if (this.attrChange('c')) {
			console.log("条件符合3");
			return true;
		}
		console.log("条件符合3->Fail");
	}).todo(function(pre, the) {
		if (pre)
			console.log(pre.c + "->" + the.c);
		else
			console.log(0 + "->" + the.c);
		// this.c=this.c+1;
	});
	// 一种实例创建方法
	var c = C.create({
		c : 2,
		a : 2
	});
	c.todo(function() {
		this.c=3;
	})
	// 实验多个实例
	var c1 = C.create({
		c : 14,
		a : 3
	});
	c1.when(function(){
		if(this.a<19){
			return true;
		}
	}).todo(function(){
		console.log("条件符合C1->"+this.a);
		this.a=this.a+2;
		
	});
	c1.todo();
	
	
	
	
	function P2(){
		this.slave='a';
		this.lan=90;
	}
	P2.prototype.pro='222';
	var p=new P2();
	var p=P2.create({
		
	});
	p.when(function(){
		if(this.slave!='a11111111111111'){
			return true;
		};
	}).todo(function(){
		console.log(this.slave);
		this.slave=this.slave+1;
		
	});
	p.todo();
	
	

}
test();