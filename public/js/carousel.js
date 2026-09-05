function createCarousel(images, options = {}) {
    let index = 0;
    const el = document.createElement('div');
    el.className = 'carousel' + (options.large ? ' carousel-large' : '');
    el.innerHTML = `
    <div class="carousel-track">
      ${images.map(src => `<img src="${src}" class="carousel-img" loading="lazy"  alt=""/>`).join('')}
    </div>
    ${images.length > 1 ? `
      <button class="carousel-arrow prev" aria-label="Imagem anterior">‹</button>
      <button class="carousel-arrow next" aria-label="Próxima imagem">›</button>
      <div class="carousel-dots">
        ${images.map((_, i) => `<span class="dot" data-i="${i}"></span>`).join('')}
      </div>
    ` : ''}
  `;

    function update() {
        el.querySelector('.carousel-track').style.transform = `translateX(-${index * 100}%)`;
        el.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === index));
    }
    el.querySelector('.prev')?.addEventListener('click', (e) => {
        e.stopPropagation(); // don't trigger card navigation
        index = (index - 1 + images.length) % images.length;
        update();
    });
    el.querySelector('.next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        index = (index + 1) % images.length;
        update();
    });
    el.querySelectorAll('.dot').forEach(dot => dot.addEventListener('click', (e) => {
        e.stopPropagation();
        index = +dot.dataset.i;
        update();
    }));

    return el;
}