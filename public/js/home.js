/* Pó de Lua — home effects: moon dust canvas, scroll progress,
   staggered card reveal, tilt + glare, cart bump. Progressive enhancement. */
(function () {
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var $ = function (s) { return document.querySelector(s); };

    // moon dust
    var cv = $('#dust');
    if (cv && !reduce) {
        var ctx = cv.getContext('2d'), W, H, dots = [], mx = -999, my = -999, visible = true;
        var dpr = Math.min(devicePixelRatio || 1, 2);
        function size() {
            var r = cv.getBoundingClientRect(); W = r.width; H = r.height;
            cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var n = Math.round(Math.min(90, W / 14)); dots = [];
            for (var i = 0; i < n; i++) dots.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + .4,
                vx: (Math.random() - .5) * .15, vy: -Math.random() * .25 - .05, a: Math.random() * .6 + .2, t: Math.random() * 6 });
        }
        size(); addEventListener('resize', size);
        cv.parentNode.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
        cv.parentNode.addEventListener('pointerleave', function () { mx = my = -999; });
        new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(cv);
        (function frame() {
            requestAnimationFrame(frame);
            if (!visible) return;
            ctx.clearRect(0, 0, W, H);
            for (var i = 0; i < dots.length; i++) {
                var d = dots[i], dx = d.x - mx, dy = d.y - my, dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 110) { d.x += dx / dist * 1.6; d.y += dy / dist * 1.6; }
                d.x += d.vx; d.y += d.vy; d.t += .02;
                if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; }
                if (d.x < -4) d.x = W + 4; if (d.x > W + 4) d.x = -4;
                ctx.globalAlpha = d.a * (.6 + .4 * Math.sin(d.t));
                ctx.fillStyle = '#e9d6a6';
                ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
            }
        })();
    }

    // staggered reveal of (dynamically rendered) product cards
    var grid = $('#productGrid');
    if (grid) {
        var io = new IntersectionObserver(function (entries) {
            var batch = entries.filter(function (e) { return e.isIntersecting; });
            batch.forEach(function (e, i) { e.target.style.setProperty('--d', (i * 80) + 'ms'); e.target.classList.add('in'); io.unobserve(e.target); });
        }, { threshold: .08 });
        function watch() { grid.querySelectorAll('.product-card:not(.in):not([data-fx])').forEach(function (c) { c.dataset.fx = 1; io.observe(c); }); }
        new MutationObserver(watch).observe(grid, { childList: true }); watch();

        // tilt + glare
        if (!reduce && matchMedia('(hover:hover)').matches) {
            grid.addEventListener('pointermove', function (e) {
                var c = e.target.closest('.product-card'); if (!c) return;
                var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
                c.style.setProperty('--ry', ((x - .5) * 8) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 8) + 'deg');
                c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
            });
            grid.addEventListener('pointerout', function (e) {
                var c = e.target.closest('.product-card'); if (!c || c.contains(e.relatedTarget)) return;
                c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg');
            });
        }
    }

    // cart badge bump
    var cc = $('#cartCount');
    if (cc) new MutationObserver(function () { cc.classList.remove('bump'); void cc.offsetWidth; cc.classList.add('bump'); })
        .observe(cc, { childList: true, characterData: true, subtree: true });
})();