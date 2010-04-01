/*
Licensed under The MIT License
==============================

Copyright (c) 2009 - 2010 Fireworks Technology Projects Inc.
[www.fireworksproject.com](http://www.fireworksproject.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */

/*jslint
onevar: true,
undef: true,
nomen: true,
eqeqeq: true,
plusplus: true,
bitwise: true,
regexp: true,
strict: true,
newcap: true,
immed: true,
maxlen: 80
*/

/*members "@mozilla.org\/thread-manager;1", DISPATCH_NORMAL, apply, 
    blocking, call, classes, constructor, die, dispatch, end, exception, 
    exception_val, extend, fulfilled, fulfilled_val, getService, 
    hasOwnProperty, interfaces, jMonad, length, mainThread, name, 
    noConflict, nsIThread, nsIThreadManager, observers, progress, prototype, 
    push, resolved, returns, run, shift, slice, unshift, warnings
*/

/*global
setTimeout: false,
Components: false
*/

"use strict";

/**
 * An anonymous enclosed function is defined here and then immediately executed
 * at the end of the file.  It is passed the global `window` object which"test
 * extend" only exists in browsers. The `window` object assigned to MODULE for
 * ease of use within the jMonad constructor.
 */
(function (undef) {

	// If we are in a browser window, `this` will be set to the `window` object.
	// If we are running as a Mozilla JavaScript module, `this` will be set to
	// the global module object.
	var MODULE = this,

		// We also provide a way of restoring MODULE.jMonad if we clobber it,
		// so we're stashing it away for that purpose here.
		$jMonad = MODULE.jMonad, // Will be undefined in most cases.

		// A function for putting tasks (functions) on the global/native stack.
		enqueue; // Assigned below.

  function construct_Warning(type, message) {
		var self = new Error(message);
		self.name = type;
		self.constructor = construct_Warning;
		return self;
	}

	function extend(proto, x) {
		var m, warnings = [];
		for (m in x) {
			if (Object.prototype.hasOwnProperty.call(x, m)) {
				if (!(m in proto)) {
					proto[m] = x[m];
				}
				else {
					warnings.push(construct_Warning("jMonadWarning",
						"Naming collision in extend() for '"+ m +"'."));
				}
			}
		}
		return warnings;
	}

	enqueue = (function () {
		try {
			if (typeof setTimeout !== "function") {
				throw 1;
			}
			return function  global_queue(fn) {
				setTimeout(fn, 0);
			};
		} catch (e) {
			var tm = Components.classes["@mozilla.org/thread-manager;1"].
							 getService(Components.interfaces.nsIThreadManager);

			return function global_queue(fn) {
				tm.mainThread.dispatch({run: fn},
					Components.interfaces.nsIThread.DISPATCH_NORMAL);
			};
		}
	}());

	function construct_pub_promise(spec) {
		return function (fulfilled, exception, progress) {
			if (typeof fulfilled === "function") {
				if (spec.fulfilled_val) {
					enqueue(function () {
						fulfilled.apply(null, spec.fulfilled_val);
					});
				}
				else {
					spec.observers.fulfilled.push(fulfilled);
				}
			}
			if (typeof exception === "function") {
				if (spec.exception_val) {
					enqueue(function () {
						exception.apply(null, spec.exception_val);
					});
				}
				else {
					spec.observers.exception.push(exception);
				}
			}
			if (typeof progress === "function") {
				spec.observers.progress.push(progress);
			}
			return construct_pub_promise(spec);
		};
	}

	function construct_promise(init) {
		var spec = {
					resolved: false,
					fulfilled_val: null,
					exception_val: null,
					observers: {
						fulfilled: [],
						exception: [],
						progress: []
					}
				};

		function make_queued(fn, args) {
			return function () {
				fn.apply(null, args);
			};
		}

		function broadcast(type, args) {
			if (spec.fulfilled_val || spec.exception_val) {
				return;
			}

			var i = 0, val,
					observers = spec.observers[type],
					len = observers.length;

			if (type === "progress") {
				for (; i < len; i += 1) {
					observers[i].apply(null, args);
				}
				return;
			}

			if (type === "fulfilled") {
				val = spec.fulfilled_val = Array.prototype.slice.call(args);
			}
			else {
				val = spec.exception_val = Array.prototype.slice.call(args);
			}

			for (; i < len; i += 1) {
				enqueue(make_queued(observers[i], val));
			}
		}

		function broadcast_fulfill() {
			broadcast("fulfilled", arguments);
		}

		function broadcast_exception() {
			broadcast("exception", arguments);
		}

		function broadcast_progress() {
			broadcast("progress", arguments);
		}

		enqueue(function init_promise() {
			init(broadcast_fulfill,
					broadcast_exception, broadcast_progress);
		});

		return construct_pub_promise(spec);
	}

	function construct_monad(proto, baton, name) {
		var self,
				p,
				done = false,
				broadcast_fulfill,
				broadcast_progress,
				broadcast_exception,
				stack = [],
				blocked = false,
				returnval;

		function end() {
			if (done) {
				return;
			}
			done = true;
			stack = [];
			broadcast_fulfill(baton,
					(arguments.length ? arguments[0] : returnval));
		}

		function die(ex) {
			if (done) {
				return;
			}
			done = true;
			stack = [];
			broadcast_exception(ex);
		}

		function progress() {
			if (done) {
				return;
			}
			broadcast_progress.apply(
					null, Array.prototype.slice.call(arguments));
		}

		function next() {
			if (done || blocked) {
				return;
			}
			if (stack.length) {
				blocked = true;
				enqueue(stack.shift());
				return;
			}
			end();
		}

		function returns(rv) {
			if (done) {
				return;
			}
			blocked = false;
			returnval = rv;
			next();
		}

		function construct_method(fn) {
			var blocking = !!fn.blocking;

			return function () {
				var args = Array.prototype.slice.call(arguments);

				stack.push(function () {
					var rv, controller = {progress: progress, end: end};

					if (blocking) {
						controller.returns = returns;
						controller.die = die;
					}
					args.unshift(returnval);
					args.unshift(baton);

					try {
						rv = fn.apply(controller, args);
					} catch (ex) {
						die(ex);
						return;
					}

					if (!blocking) {
						returns(rv);
					}
				});

				return this;
			};
		}

		self = construct_promise(
				function init_monad_promise(fulfill, exception, progress) {
					broadcast_fulfill = fulfill;
					broadcast_progress = progress;
					broadcast_exception = exception;
					next();
				});

		for (p in proto) {
			if (Object.prototype.hasOwnProperty.call(proto, p)) {
				self[p] = (typeof proto[p] === "function") ?
					construct_method(proto[p]) : proto[p];
			}
		}
		return self;
	}

	function jMonad() {

		var monads_memo = {},
			warnings = [],
			prototypes = {};

		function monad(name, start_baton) {
			if (start_baton ||
					!Object.prototype.hasOwnProperty.call(monads_memo, name)) {
				monads_memo[name] = construct_monad(
						(prototypes[name] = prototypes[name] || {}),
						start_baton, name);
			}
			return monads_memo[name];
		}

		monad.warnings = warnings;

		monad.extend = function pub_extend(name, x) {
			var w = extend((prototypes[name] = prototypes[name] || {}), x),
					i = 0;
			for (; i < w.length; i += 1) {
				warnings.push(w[i]);
			}
			return this;
		};

		return monad;

	} // End of jMonad constructor function def

	jMonad.noConflict = function reverse_clobber() {
		MODULE.jMonad = $jMonad;
		return this;
	};

	// MODULE may be the window object or a Mozilla JSM global scope.
	// It is a reference to the `this` object passed into the enclosed
	// application construction closure. (seen below)
	MODULE.jMonad = jMonad;

}());

