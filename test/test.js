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
      same(m, a, "Monads built with the constructor are cached by name.");
      var b = M("another monad");
      ok((m != b && a != b),
        "Passing a different name to a constructor yields a new monad.");
    });

  test(".extend()", 12, function () {

      equals(typeof M.extend, "function", ".extend() is a function.");

      var m = M(".extend() test");
      equals(typeof m.extend, "undefined", "monad.extend() does not exist.");

      var x = {y: function () {}, a: 1};
      var y = {z: function () {}, a: 2};
      same(M.extend(x).extend(y), M,
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

  test(".extend()ed methods.", 13, function () {

      var arg = [1,2,3];

      function a (f, g, h) {
        equals(typeof f, "function", "Continuation passed.");
        equals(g, 1, "Arg 0 passed.");
        same(h, arg, "Arg 1 passed.");
        f();
      }

      function b (g, h, f) {
        equals(typeof f, "undefined", "Continuation NOT passed.");
        equals(g, 1, "Arg 0 passed.");
        same(h, arg, "Arg 1 passed.");
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

      var m = M("extending monad");
      equals(typeof m.e, "undefined", "Not extended with prototype.e");
      equals(typeof m.f, "undefined", "Not extended with prototype.f");
      equals(typeof m.g, "undefined", "Not extended with prototype.g");
      equals(m.y, 0, "Extended with y");
      m.x(1, arg).z(1, arg).x(1, arg);

    });

}, false);
