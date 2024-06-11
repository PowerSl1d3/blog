const minimumSiteNameLength = 5;
const textTypingSpeed = 240;
const textTypingInterval = 3000;

startAnimation('site-name');

function startAnimation(id) {
  const siteElement = document.getElementsByClassName(id)[0]
  const siteName = siteElement.innerHTML

  var visible = true;
  var con = document.getElementById('console');
  var letterCount = 1;
  var step = 1;
  var waiting = false;

  window.setInterval(function() {
    if (letterCount === minimumSiteNameLength && waiting === false) {
      waiting = true;
      siteElement.innerHTML = siteName.substring(0, letterCount)

      window.setTimeout(function() {
        step = 1;
        letterCount += step;
        waiting = false;
      }, textTypingInterval)
    } else if (letterCount === siteName.length + 1 && waiting === false) {
      waiting = true;

      window.setTimeout(function() {
        step = -1;
        letterCount += step;
        waiting = false;
      }, textTypingInterval)
    } else if (waiting === false) {
      siteElement.innerHTML = siteName.substring(0, letterCount)
      letterCount += step;
    }
  }, textTypingSpeed)

  window.setInterval(function() {
    if (visible === true) {
      con.className = 'console-underscore hidden'
      visible = false;
    } else {
      con.className = 'console-underscore'
      visible = true;
    }
  }, 400)
}
