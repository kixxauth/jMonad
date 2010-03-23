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
window: true,
Components: false,
console: false,
exports: true
*/

"use strict";

// Def jMonad global.
(function (window, undef) {
  var $window = (typeof window === "object") ? window.jMonad : undef,
      $exports = exports;

  function jMonad() {
  var jMonad_log = (function () {
        // Mozilla XPCOM is available.
        try {
          if (typeof Components === "object" &&
                typeof Components.classes === "object") {
              return Components.classes["@mozilla.org/fuel/application;1"]
                       .getService(Components.interfaces.fuelIApplication)
                       .console.log;
          }
        } catch (e) {/* ignore the error */}

        // console.log is available.
        if (typeof console === "object" &&
              typeof console.log === "function") {
          return console.log;
        }

        if (typeof dump === "function") {
          return function (msg) { dump(msg +"\n"); };
        }

        // Return a black hole.
        return function () {};
      }()),

      signals = (function () {
        var sigs = {};

        function construct_signal(name) {
          jMonad_log("Building signal: "+ name);
          var observers = {};

          return {
            observe: function signal_observe(f) {
              jMonad_log("signal.observe(): "+ name);
              observers[f] = f;
              if (this.value) {
                f.call(null, this.value);
              }
            },

            ignore: function signal_ignore(f) {
              jMonad_log("signal.ignore(): "+ name);
              delete observers[f];
            },

            broadcast: function signal_broadcast(context, data) {
              jMonad_log("signal.broadcast(): "+ name);
              var ob;
              this.value = data;

              for (ob in observers) {
                if (Object.prototype.hasOwnProperty.call(observers, ob)) {
                  observers[ob].apply(context, this.value);
                }
              }
            }
          };
        }

        return function (name) {
            jMonad_log("jMonad_signals() fetch: "+ name);
            return sigs[name] || (sigs[name] = construct_signal(name));
          };
      }());

  jMonad_log.non_blocking = true;

  function jMonad_broadcast(signal) {
    jMonad_log(".broadcast(): "+ signal);
    signals(signal).broadcast(this, Array.prototype.slice.call(arguments, 1));
    return this;
  }
  jMonad_broadcast.non_blocking = true;

  function jMonad_check(signal) {
    jMonad_log(".check(): "+ signal);
    return signals(signal).value;
  }
  jMonad_check.non_blocking = true;

  function jMonad_observe() {
    jMonad_log(".observe(): "+ Array.prototype.slice.call(arguments)
            .join("\n"));
    var callbacks = [], sigs = [], i = 0, n = 0;

    for(; i < arguments.length; i += 1) {
      if (typeof arguments[i] === "function") {
        callbacks.push(arguments[i]);
      }
      else {
        sigs.push(arguments[i]);
      }
    }

    for (i = 0; i < callbacks.length; i += 1) {
      for (; n < sigs.length; n += 1) {
        signals(sigs[n]).observe(callbacks[i]);
      }
    }

    return this;
  }
  jMonad_observe.non_blocking = true;

  function jMonad_observe_once(signal, callback) {
    jMonad_log(".observeOnce(): "+ signal);
    signal = signals(signal);
    if (typeof callback !== "function") {
      jMonad_log(".observeOnce(): The callback arguments was "+
          arguments[arguments.length -1]);
      jMonad_broadcast("jMonad.warning",
          "The callback argument passed to .observeOnce() by '"+
          (arguments.callee.caller.name || "anonymous")+
          "()' is not a function.");
    }

    signal.observe(function () {
        signal.ignore(arguments.callee);
        callback.apply(this, Array.prototype.slice.call(arguments));
      });

    return this;
  }
  jMonad_observe_once.non_blocking = true;

  function jMonad_ignore(signal, callback) {
    jMonad_log(".ignore(): "+ signal);
    signals(signal).ignore(callback);
    return this;
  }
  jMonad_ignore.non_blocking = true;

  function jMonad_wait(continuation /* signal names and callbacks */) {
    jMonad_log(".wait(): args:\n"+ Array.prototype.slice.call(arguments, 1)
            .join("\n"));
    var callbacks = [], i = 0,
        observers = [],
        timer,
        args = Array.prototype.slice.call(arguments, 1),
        monad = this;

    function handler() {
      var i = 0;
      jMonad_log(".wait() timer: "+ timer);
      // Remove all listeners.
      if (typeof timer === "number") {
        window.clearTimeout(timer);
        timer = null;
      }

      for (; i < observers.length; i += 1) {
        signals(observers[i]).ignore(handler);
      }

      for (i = 0; i < callbacks.length; i += 1) {
        callbacks[i].call(monad);
      }
      // The continuation is invoked AFTER all of the callbacks.
      continuation();
    }

    for (; i < args.length; i += 1) {
      if (typeof args[i] === "function") {
        // If this argument is a function, it is meant to be a callback.
        callbacks.push(args[i]);
      }
      else if (typeof args[i] === "number" && timer === undef) {
        // If this argument is a number, it is meant to set a timer.
        // The `+` is used to convert possible strings to ints.
        timer = window.setTimeout(handler, +args[i]);
      }
      else {
        // If this argument is anything but a function or a number,
        // it is meant to be a signal identifier.
        observers.push(args[i]);
        signals(args[i]).observe(handler);
      }
    }
  }

  function jMonad_wait_and(continuation /* signal names and callbacks */) {
    jMonad_log(".waitAnd(): args:\n"+ Array.prototype.slice.call(arguments, 1)
            .join("\n"));
    var observed = {}, i,
        callbacks = [],
        timer,
        args = Array.prototype.slice.call(arguments, 1);

    function make_handler(signal) {
      return function (/* signal data */) {
          var ok = true, s, i;

          // Convert arguments to an array and set this observer.
          observed[signal] = true;
          jMonad_log("waitAnd(): Got signal "+ signal);

          // Check to see if all the registered observers have been set.
          for (s in observed) {
            if (!observed[s]) {
              jMonad_log("waitAnd(): missing "+ s);
              ok = false;
              break;
            }
          }

          if (ok) {
            for(i = 0; i < callbacks.length; i += 1) {
              callbacks[i]();
            }
            // The continuation is invoked AFTER all of the callbacks.
            continuation();
          }
        };
    }

    for (i = 0; i < args.length; i += 1) {
      if (typeof args[i] === "function") {
        // If this argument is a function, it is meant to be a callback.
        callbacks.push(args[i]);
      }
      else if (typeof args[i] === "number" && timer === undef) {
        // If this argument is a number, it is meant to set a timer.
        // The `+` is used to convert possible strings to ints.
        timer = window.setTimeout(make_handler(args[i]), +args[i]);
      }
      else {
        // If this argument is anything but a function or a number,
        // it is meant to be a signal identifier.
        observed[args[i]] = false;
        jMonad_observe_once(args[i], make_handler(args[i]));
      }
    }
  }

  // Observe the jMonad.warning stream internally.
  jMonad_observe("jMonad.warning", function internal_warning_handler(message) {
        jMonad_log("jMonad.warning: "+ message);
      });

  // Construct jMonad in a closure.
  return (function () {

        // Memoization of previously created monad objects.
    var mem = {},

        // The proto object maps dynamic members to a monad object
        // when the monad object is created.
        proto = {};

    // A publicly exposed function used to map dynamic extensions to jMonad.
    // It extends the proto object with the passed object.
    function extend_jMonad(x) {
      var m;
      for (m in x) {
        if (Object.prototype.hasOwnProperty.call(x, m)) {
          if (!Object.prototype.hasOwnProperty.call(proto, m)) {
            proto[m] = x[m];
          }
          else {
            jMonad_broadcast("jMonad.warning",
              "Naming collision in extend() for '"+ m +"'.");
          }
        }
      }

      return this;
    }

    // Constructor for new monad objects.
    function construct_monad(monad_name) {
      var monad = {name: monad_name}, m,
          stack = [], blocked = false;

      // This is passed to each invocation of a dynamic method as the first
      // parameter. The stack is blocked until this function is called from the
      // dynamic method that was invoked.
      function done() {
        var continuation;

        if (!stack.length) {
          blocked = false;
        }
        else {
          continuation = stack.shift();
          jMonad_log("done() args[0]: "+ typeof continuation.args[0]);
          continuation.f.apply(monad, continuation.args);
          if (continuation.args[0] !== done) {
            arguments.callee();
          }
        }
      }

      // A wrapper helper to create dynamic blocking methods and
      // push them onto this monad's stack.
      function make_blocking_method(f) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(done);
            if (!blocked && !stack.length) {
              blocked = true;
              jMonad_log("make_blocking_method("+f.name+") args[0]: "+ typeof args[0]);
              f.apply(monad, args);
            }
            else {
              stack.push({f: f, args: args});
            }
            return monad;
          };
      }

      // A wrapper helper to create dynamic non blocking methods and
      // push them onto this monad's stack.
      function make_non_blocking_method(f) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            if (!blocked && !stack.length) {
              jMonad_log("make_none_blocking_method("+f.name+") args[0]: "+ typeof args[0]);
              f.apply(monad, args);
            }
            else {
              stack.push({f: f, args: args});
            }
            return monad;
          };
      }

      // Builtin dynamic prototypes.
      // The `non_blocking` flag must be set to prevent a method from being
      // wrapped as a blocking method.
      proto.log = jMonad_log;

      proto.push = function jMonad_block(f) {
        var args = Array.prototype.slice.call(arguments);
        if (!blocked && !stack.length) {
          blocked = true;
          f.apply(monad, args);
        }
        else {
          stack.push({f: f, args: args});
        }
        return monad;
      };
      proto.push.non_blocking = true;

      proto.block = function jMonad_block(f) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(done);
        if (!blocked && !stack.length) {
          blocked = true;
          f.apply(monad, args);
        }
        else {
          stack.push({f: f, args: args});
        }
        return monad;
      };
      proto.block.non_blocking = true;

      proto.broadcast = jMonad_broadcast;
      proto.observe = jMonad_observe;
      proto.observeOnce = jMonad_observe_once;
      proto.wait = jMonad_wait;
      proto.waitAnd = jMonad_wait_and;
      proto.ignore = jMonad_ignore;

      // Extend this monad object with the dynamic methods.
      for (m in proto) {
        if (Object.prototype.hasOwnProperty.call(proto, m)) {
          jMonad_log("Appending member: "+ m);
          if (typeof proto[m] === "function") {
            jMonad_log("Dynamic member '"+ m +"' is a function.");
            // If the member is a function, we need to wrap it.
            monad[m] = proto[m].non_blocking ?
                      make_non_blocking_method(proto[m]) :
                      make_blocking_method(proto[m]);
          }
          else if (proto[m] !== undef) {
            jMonad_log("Dynamic member '"+ m +"' is NOT a function.");
            // Anything other than a function, as long as it is not undef,
            // just gets a reference pointer to it.
            monad[m] = proto[m];
          }
        }
      }

      return monad;
    }

    // The monad constructor function itself.
    function self(name) {
        return mem[name] || (mem[name] = construct_monad(name));
    }

    // Extend this monad constructor with the static members of jMonad.
    self.extend = extend_jMonad;
    self.log = function (message) {
      jMonad_log(message);
      return self;
    };
    self.broadcast = jMonad_broadcast;
    self.check = jMonad_check;
    self.observe = jMonad_observe;
    self.observeOnce = jMonad_observe_once;
    self.ignore = jMonad_ignore;

    return self;
  }());
  }

  jMonad.noConflict = function no_clobber() {
    if (typeof window === "object") {
      window.jMonad = $window;
    }
    exports = $exports;
    return jMonad;
  };

  if (typeof window === "object") {
    window.jMonad = jMonad;
  }
  exports = jMonad;

}(window));

