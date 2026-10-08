// Hala's website widget. A business adds one tag to its site:
//   <script src="https://<hala>/widget.js" data-business="<slug>" defer></script>
// Optional: data-language="ar" or "en" (otherwise the business's own language), and data-label
// for the button's text. It adds a chat button and, when opened, a frame holding the chat, served
// by Hala. The chat lives in the frame, isolated from the site's styles and scripts; the site
// only gets the button and the frame, styled inline (docs/design/DESIGN.md, "The widget's
// shell"). Hala only lets the frame show on the sites the business allowed.
//
// This is the source: `pnpm widget` minifies it to public/widget.js, which sites load.
(function () {
  var script = document.currentScript;
  if (!script || !script.dataset.business) return;
  var data = script.dataset;
  var origin = new URL(script.src).origin;
  var src =
    origin +
    "/widget/" +
    encodeURIComponent(data.business) +
    (data.language ? "?lang=" + encodeURIComponent(data.language) : "");
  var side = data.language === "ar" ? "left" : "right";
  var label = data.label || "Chat";
  var phone = matchMedia("(max-width:639px)");
  var reducedMotion = matchMedia("(prefers-reduced-motion:reduce)");

  var frame = document.createElement("iframe");
  frame.id = "hala-widget-frame";
  // Its name tells the chat it was opened here, so it offers its own close button.
  frame.name = "hala-widget";
  frame.title = label;
  frame.hidden = true;

  var button = document.createElement("button");
  button.type = "button";
  // Its name stays the label on phones too, where only the icon shows.
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", frame.id);

  // Phosphor's chat-circle-dots icon, filled, its points rounded to whole units. Built as
  // elements rather than HTML, which some sites' security policies refuse.
  var svg = "http://www.w3.org/2000/svg";
  var icon = document.createElementNS(svg, "svg");
  icon.setAttribute("viewBox", "0 0 256 256");
  icon.setAttribute("fill", "currentColor");
  icon.setAttribute("aria-hidden", "true");
  icon.style.cssText = "width:24px;height:24px;flex:none";
  var path = document.createElementNS(svg, "path");
  path.setAttribute(
    "d",
    "M128,24A104,104,0,0,0,36,177L25,211a16,16,0,0,0,20,20l34-11A104,104,0,1,0,128,24ZM84,140a12,12,0,1,1,12-12A12,12,0,0,1,84,140Zm44,0a12,12,0,1,1,12-12A12,12,0,0,1,128,140Zm44,0a12,12,0,1,1,12-12A12,12,0,0,1,172,140Z",
  );
  icon.appendChild(path);
  var text = document.createElement("span");
  text.textContent = label;
  button.appendChild(icon);
  button.appendChild(text);

  // Hala's tokens as fixed colors (the site doesn't load them): surface, accent, on-accent, and
  // the level 2 and 3 shadows. On a desktop, a 400px panel above an accent pill; on a phone the
  // chat fills the screen (inside its safe areas) and the button, a 56px circle there, steps
  // aside while it's open. Set again whenever the screen crosses that width.
  function layout() {
    var small = phone.matches;
    frame.style.cssText =
      "position:fixed;z-index:2147483647;border:0;background:#fefdfc;" +
      (frame.hidden ? "display:none;" : "") +
      (small
        ? "top:0;left:0;width:100%;height:100%;box-sizing:border-box;" +
          "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);"
        : "bottom:84px;" +
          side +
          ":20px;width:400px;max-width:calc(100vw - 40px);height:640px;max-height:calc(100vh - 104px);" +
          "border-radius:20px;box-shadow:0 28px 60px -18px #2f1d0b52,0 0 0 1px #352c2314;");
    button.style.cssText =
      "position:fixed;z-index:2147483647;bottom:20px;" +
      side +
      ":20px;display:" +
      (small && !frame.hidden ? "none" : "flex") +
      ";align-items:center;justify-content:center;gap:8px;margin:0;box-sizing:border-box;" +
      (small
        ? "width:56px;height:56px;padding:0;"
        : "height:48px;padding:0 20px 0 16px;") +
      "border:0;border-radius:999px;background:#0e726e;color:#f8fdfc;" +
      "font:500 15px/1 system-ui,sans-serif;letter-spacing:normal;text-transform:none;cursor:pointer;" +
      "box-shadow:0 12px 28px -12px #382b1e38,0 0 0 1px #352c2312;";
    text.style.display = small ? "none" : "";
  }

  function setOpen(open) {
    // The chat loads the first time it's opened, not with the page.
    if (open && !frame.src) frame.src = src;
    frame.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    layout();
    // It arrives: fades in and rises 8px, unless the visitor prefers less motion.
    if (open && !reducedMotion.matches && frame.animate) {
      frame.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 280, easing: "cubic-bezier(.2,0,0,1)" },
      );
    }
    if (!open) button.focus();
  }

  layout();
  if (phone.addEventListener) phone.addEventListener("change", layout);
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
