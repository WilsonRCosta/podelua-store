// Renders a swipeable image carousel
function renderCarousel(product, size = 'card') {
  const images = product.images && product.images.length
      ? product.images
      : [{ url: '/images/placeholder.png', color: null }];

  const slides = images
      .map((img) => `<img src="${img.url}" class="carousel-img" alt="${product.name}" loading="lazy" />`)
      .join('');

  const arrowButtons = images.length > 1 ? `
    <button class="carousel-arrow prev" data-carousel-prev="${product.id}" aria-label="Imagem anterior">‹</button>
    <button class="carousel-arrow next" data-carousel-next="${product.id}" aria-label="Próxima imagem">›</button>
  ` : '';

  const dotsMarkup = images.length > 1 ? `
    <div class="carousel-dots">
      ${images.map((_, i) => `<span class="dot" data-carousel-dot="${product.id}" data-index="${i}"></span>`).join('')}
    </div>
  ` : '';

  if (size === 'large') {
    return `
      <div class="carousel carousel-${size}" data-carousel-id="${product.id}" data-index="0">
        <div class="carousel-track">${slides}</div>
        ${arrowButtons}
      </div>
      ${dotsMarkup ? `<div class="carousel-dots-row">${dotsMarkup}</div>` : ''}
    `;
  }

  return `
    <div class="carousel carousel-${size}" data-carousel-id="${product.id}" data-index="0">
      <div class="carousel-track">${slides}</div>
      ${arrowButtons}
      ${dotsMarkup}
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

  document.querySelectorAll(`.dot[data-carousel-dot="${carouselId}"]`)
      .forEach((d) => d.classList.toggle('active', parseInt(d.dataset.index, 10) === index));

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

// ----- Product Customization -----

function slugifyLabel(label) {
  return label
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
}

function renderCustomFieldsForm(product) {
  const fields = product.customFields || [];
  if (fields.length === 0) return '';

  return `
    <div class="custom-fields" data-custom-fields-for="${product.id}">
      <h3 class="custom-fields-title">Personalização</h3>
      ${fields.map((f) => {
    const key = slugifyLabel(f.label);
    if (f.type === 'date') {
      return `
            <label class="custom-field">
              <span>${f.label}</span>
              <input type="date" name="${key}" required />
            </label>`;
    }
    if (f.type === 'integer') {
      return `
            <label class="custom-field">
              <span>${f.label}</span>
              <input type="number" step="1" inputmode="numeric" name="${key}" required />
            </label>`;
    }
    if (f.type === 'decimal') {
      const decimals = f.limit || 2;
      const step = (1 / Math.pow(10, decimals)).toFixed(decimals);
      return `
            <label class="custom-field">
              <span>${f.label}</span>
              <input type="number" step="${step}" inputmode="decimal" name="${key}" required />
            </label>`;
    }
    // text
    const maxLength = f.limit || 50;
    return `
          <label class="custom-field">
            <span>${f.label}</span>
            <input type="text" name="${key}" maxlength="${maxLength}" required />
            <small class="char-count">0/${maxLength}</small>
          </label>`;
  }).join('')}
    </div>
  `;
}

// Reads and validates the form; returns an array of {label, value} pairs,
// [] when the product has no customization, or null if something's
// missing/invalid (and flags it for the shopper via the native input UI).
function collectCustomFieldValues(product) {
  const fields = product.customFields || [];
  if (fields.length === 0) return [];

  const container = document.querySelector(`[data-custom-fields-for="${product.id}"]`);
  if (!container) return [];

  const values = [];
  for (const f of fields) {
    const key = slugifyLabel(f.label);
    const input = container.querySelector(`[name="${key}"]`);
    if (!input || !input.value || !input.checkValidity()) {
      if (input) input.reportValidity();
      return null;
    }
    values.push({ label: f.label, value: input.value });
  }
  return values;
}