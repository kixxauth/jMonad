window.addEventListener("load",
function () {

  var jM, M;

  test("jMonad is a free symbol", 3, function () {
      equals(typeof jMonad, "function", "jMonad() is a free var.");
      equals(typeof window.jMonad, "function", "We also have window.jMonad().");
      ok(exports === window.jMonad, "The free `exports` symbol points to jMonad().");
    });

  test("jMonad.noConflict()", 3, function () {
      stop();
      jM = jMonad.noConflict();
      start();
      equals(typeof jM, "function", "jM() has been asigned.");
      equals(window.jMonad, 1, "Revert window.jMonad.");
      same(exports, {}, "Revert exports.");
    });

  test("jMonad() constructor", 3, function () {
      M = jM();
      equals(typeof M, "function", "M() has been built.");

      var m = M("monad name");
      var a = M("monad name");
      ok(m === a, "Monads built with the constructor are cached by name.");
      var b = M("another monad");
      ok((m != b && a != b),
        "Passing a different name to a constructor yields a new monad.");
    });

  test(".log()", 2, function () {
      ok(M.log() === M,
        "Static .log() is available and returns the monad constructor.");

      var m = M("log test");
      ok(m.log() === m,
        "Dynamic .log() is available and returns the monad.");
    });

  test(".extend()", 12, function () {

      equals(typeof M.extend, "function", ".extend() is a function.");

      var m = M(".extend() test");
      equals(typeof m.extend, "undefined", "monad.extend() does not exist.");

      var x = {y: function () {}, a: 1};
      var y = {z: function () {}, a: 2};
      ok(M.extend(x).extend(y) === M,
        "Static .extend() returns the monad constructor for chaining.");
      M.observeOnce("jMonad.warning", function (warning) {
          equals(warning, "Naming collision in extend() for 'a'.",
            "Warning issued for clobbering with extend().");
        });

      m = M(".extend() test");
      equals(typeof m.y, "undefined", "Cached monad not extended with y.");
      equals(typeof m.a, "undefined", "Cached monad not extended with a.");
      equals(typeof m.z, "undefined", "Cached monad not extended with z.");

      m = M("another .extend() test");
      equals(typeof m.y, "function", "New monad extended with y.");
      ok(m.y != x.y, "Extended y has been wrapped by another function.");
      equals(m.a, 1, "New monad extended with a == 1, not a == 2.");
      equals(typeof m.z, "function", "New monad extended with z.");
      ok(m.z != y.z, "Extended y has been wrapped by another function.");

    });

  test(".extend()ed methods.", 16, function () {

      var arg = [1,2,3], m;

      function a (f, g, h) {
        equals(typeof f, "function", "Continuation passed.");
        equals(g, 1, "Arg 0 passed.");
        ok(h === arg, "Arg 1 passed.");
        ok(this === m, "`this` points to the monad object.");
        f();
      }

      function b (g, h, f) {
        equals(typeof f, "undefined", "Continuation NOT passed.");
        equals(g, 1, "Arg 0 passed.");
        ok(h === arg, "Arg 1 passed.");
        ok(this === m, "`this` points to the monad object.");
      }
      b.non_blocking = true;

      function c (f, g) {
        ok(false, "c() should never be called.");
      }

      function d (f, g) {
        ok(false, "d() should never be called.");
      }
      d.non_blocking = true;

      function Foo() {
        this.x = a;
        this.y = 0;
        this.z = b;
      }
      Foo.prototype = {e:1, f:c, g:d};

      // Create a new monad contructor that has not already been extended.
      M = jM();
      M.extend(new Foo());

      m = M("extending monad");
      equals(typeof m.e, "undefined", "Not extended with prototype.e");
      equals(typeof m.f, "undefined", "Not extended with prototype.f");
      equals(typeof m.g, "undefined", "Not extended with prototype.g");
      equals(m.y, 0, "Extended with y");
      m.x(1, arg).z(1, arg).x(1, arg);

    });

  test("static signals", 13, function () {
      // Create a new monad contructor that has not already been extended.
      var M = jM();

      equals(typeof M.check("test"), "undefined",
        "First .check() is undefined.");

      var vA = 1;
      var vB = {};

      function ob(a, b) {
        equals(a, vA, "First arg.");
        ok(b === vB, "Second arg.");
        ok(this === M, "`this` points to the monad constructor function.");
      }

      function mu() {
        ok(this === M, "`this` points to the monad constructor function.");
      }

      var m = M.observe("test", mu)
        .observeOnce("test", ob)
        .broadcast("test", vA, vB);

      same(M.check("test"), [vA, vB], "Second .check()");
      ok(m === M, ".broadcast() returns the monad constructor function.");

      M.broadcast("test", 44)
        .ignore("test", mu)
        .broadcast("new", 77);
      same(M.check("test"), [44], "Third .check()");
      same(M.check("new"), [77], "Fourth .check()");

      M.observe("test", "new",
          (function () {
             var called = 0;

             return function (val) {
                 called += 1;
                 if (called === 1) {
                   equals(val, 44, "First call is 44.");
                 } else if (called === 2) {
                   equals(val, 77, "Second call is 77.");
                 } else {
                   ok(false, "Should not be called a 3rd time.");
                 }
               };
           }()));

      M.observe("na", function (x) {
            equals(typeof x, "undefined", "No data passed.");
          })
        .broadcast("na");

      M.observeOnce("jMonad.warning", function (msg) {
            ok(false, "No warning is issued if "+
                      "no callback function is passed to observe.");
          });
      M.observe("signal", "message");

    });

  test("wait", 4, function () {
      stop();
      M = jM();
      var mark = new Date().getTime();
      M(1)
        .wait("one", 300, function () {
            // We never fire the "one" event.
            var end = new Date().getTime();
            var diff = end - mark;
            ok(270 < diff && diff < 310, "Wait elapsed "+ (end - mark));

            ok(this === M(1), "`this' is bound to the current monad.");

            // Even though we broadcast "one" here, wait will ignore it.
            M.broadcast("one", 1);
          })
        .push(function () {
            var end = new Date().getTime();
            var diff = end - mark;
            ok(270 < diff && diff < 310, "Wait elapsed "+ (end - mark));
            ok(this === M(1), "`this' is bound to the current monad.");
            start();
          });
      stop();
    });

}, false);
