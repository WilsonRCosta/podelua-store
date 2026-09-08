// Renders a swipeable image carousel
function renderCarousel(product, size = 'card') {
  const images = product.images && product.images.length
      ? product.images
      : [{ url: '/images/placeholder.png', color: null }];

  const slides = images
      .map((img) => `<img src="${img.url}" class="carousel-img" alt="${product.name}" loading="lazy" />`)
      .join('');

  const arrows = images.length > 1 ? `
    <button class="carousel-arrow prev" data-carousel-prev="${product.id}" aria-label="Imagem anterior">‹</button>
    <button class="carousel-arrow next" data-carousel-next="${product.id}" aria-label="Próxima imagem">›</button>
    <div class="carousel-dots">
      ${images.map((_, i) => `<span class="dot" data-carousel-dot="${product.id}" data-index="${i}"></span>`).join('')}
    </div>
  ` : '';

  return `
    <div class="carousel carousel-${size}" data-carousel-id="${product.id}" data-index="0">
      <div class="carousel-track">${slides}</div>
      ${arrows}
    </div>
  `;
}

// Renders just the row of color swatches for a product, if it has any.
// Returns '' when no image has a color — caller can insert the result
// anywhere without needing to check first.
function renderColorSwatches(product) {
  const images = product.images || [];
  const hasColors = images.some((img) => img.color);
  if (!hasColors) return '';

  return `
    <div class="color-swatches" data-swatches-for="${product.id}">
      ${images.map((img, i) => img.color ? `
        <button
          class="color-swatch${i === 0 ? ' active' : ''}"
          style="background:${img.color}"
          data-carousel-dot="${product.id}"
          data-index="${i}"
          aria-label="Ver cor"
        ></button>
      ` : '').join('')}
    </div>
  `;
}

function formatPrice(price) {
  const value = Number(price);

  if (!Number.isFinite(value)) {
    console.error('Invalid product price:', price);
    return '—';
  }

  return value.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  });
}

// Reads which image/color is currently selected in a given carousel,
// so "add to cart" can capture exactly what the shopper is looking at.
function getSelectedColor(product) {
  const carouselEl = document.querySelector(`.carousel[data-carousel-id="${product.id}"]`);
  const index = carouselEl ? parseInt(carouselEl.dataset.index, 10) || 0 : 0;
  const images = product.images || [];
  return images[index]?.color || null; // null when that image (or the product) has no color
}

function moveCarousel(carouselId, delta, absoluteIndex) {
  const el = document.querySelector(`.carousel[data-carousel-id="${carouselId}"]`);
  if (!el) return;
  const track = el.querySelector('.carousel-track');
  const slideCount = track.children.length;
  let index = parseInt(el.dataset.index, 10) || 0;
  index = absoluteIndex !== undefined ? absoluteIndex : (index + delta + slideCount) % slideCount;
  el.dataset.index = index;
  track.style.transform = `translateX(-${index * 100}%)`;
  el.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === index));

  // Keep the color-swatch row (if any) in sync, regardless of what
  // triggered the change — arrow, dot, or a swatch click itself.
  const swatchRow = document.querySelector(`.color-swatches[data-swatches-for="${carouselId}"]`);
  if (swatchRow) {
    swatchRow.querySelectorAll('.color-swatch').forEach((s) => {
      s.classList.toggle('active', parseInt(s.dataset.index, 10) === index);
    });
  }
}

const CATEGORY_LABELS = {
  decoracao: 'Decoração',
  bijutaria: 'Bijutaria',
  bebe: 'Bebé',
};
