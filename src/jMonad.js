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

/*global
window: true
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
		$jMonad = MODULE.jMonad; // Will be undefined in most cases.

  function construct_Warning(type, message) {
		var self = new Error(message);
		self.name = type;
		self.constructor = construct_Warning;
		return self;
	}

	function extend(proto, x, reserved) {
		reserved = reserved || {};
		var m, warnings = [];
		for (m in x) {
			if (Object.prototype.hasOwnProperty.call(x, m)) {
				if (!(m in proto) && !(m in reserved)) {
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

	function construct_monad(proto) {
		var self = {}, p;
		for (p in proto) {
			if (Object.prototype.hasOwnProperty.call(proto, p)) {
				if (typeof proto[p] === "function") {
					self[p] = function () {};
				}
				else {
					self[p] = proto[p];
				}
			}
		}
		return self;
	}

	function jMonad() {

		var monads_memo = {},
			warnings = [],
			prototypes = {},
			reserved = {"end": true};

		function monad(name, start_baton) {
			if (!Object.prototype.hasOwnProperty.call(monads_memo, name)) {
				monads_memo[name] = construct_monad(prototypes[name] = prototypes[name] || {});
			}
			return monads_memo[name];
		}

		monad.warnings = warnings;

		monad.extend = function pub_extend(name, x) {
			var w = extend((prototypes[name] = prototypes[name] || {}), x, reserved),
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

