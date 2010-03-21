window.addEventListener("load",
function () {
  dump("start testing\n");

  test("start testing", 1, function () {
      ok(true, "this test is cool");
    });
}, false);
