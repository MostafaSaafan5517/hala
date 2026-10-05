// Hala's website widget. A business adds one tag to its site:
//   <script src="https://<hala>/widget.js" data-business="<slug>" defer></script>
// Optional: data-language="ar" or "en" (otherwise the business's own language), and
// data-label for the button's text. It adds a chat button and, when opened, a frame holding the
// chat, served by Hala. The chat lives in the frame, isolated from the site's styles and scripts;
// Hala only lets the frame show on the sites the business allowed.
(function () {
  var script = document.currentScript;
  if (!script || !script.dataset.business) return;
  var origin = new URL(script.src).origin;
  var params = new URLSearchParams();
  if (script.dataset.language) params.set("lang", script.dataset.language);
  var src =
    origin +
    "/widget/" +
    encodeURIComponent(script.dataset.business) +
    (params.toString() ? "?" + params.toString() : "");
  var rtl = script.dataset.language === "ar";
  var side = rtl ? "left" : "right";
  var frameId = "hala-widget-frame";

  var frame = document.createElement("iframe");
  frame.id = frameId;
  frame.title = script.dataset.label || "Chat";
  frame.hidden = true;
  frame.style.cssText =
    "position:fixed;bottom:88px;" +
    side +
    ":20px;width:380px;max-width:calc(100vw - 40px);height:600px;" +
    "max-height:calc(100vh - 120px);border:0;border-radius:12px;" +
    "box-shadow:0 10px 40px rgba(0,0,0,.2);background:#fff;z-index:2147483647;";

  var button = document.createElement("button");
  button.type = "button";
  button.textContent = script.dataset.label || "Chat";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", frameId);
  button.style.cssText =
    "position:fixed;bottom:20px;" +
    side +
    ":20px;padding:12px 20px;border:0;border-radius:999px;" +
    "background:#111;color:#fff;font:600 15px/1 system-ui,sans-serif;cursor:pointer;" +
    "box-shadow:0 4px 16px rgba(0,0,0,.25);z-index:2147483647;";

  function setOpen(open) {
    // The chat loads the first time it's opened, not with the page.
    if (open && !frame.src) frame.src = src;
    frame.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (!open) button.focus();
  }

  button.addEventListener("click", function () {
    setOpen(frame.hidden);
  });
  // The chat's close button, sent from Hala's frame only.
  window.addEventListener("message", function (event) {
    if (
      event.origin === origin &&
      event.data &&
      event.data.type === "hala:close"
    ) {
      setOpen(false);
    }
  });

  document.body.appendChild(frame);
  document.body.appendChild(button);
})();
