// ============================================================
// NYXARA — radial menu
// six frequencies on the left edge of the night
// ============================================================

const ARC_RADIUS = 340; // px — soft arc bulging in from the left edge
const ARC_SPREAD = 0.62; // radians of arc the six names occupy

export class RadialMenu {
  constructor(cities, onCitySelect) {
    this.cities = cities;
    this.onCitySelect = onCitySelect;
    this.activeIndex = -1;
    this.items = [];

    if (typeof document === 'undefined') return;
    const mount = document.getElementById('ui-root') || document.body;

    this.root = document.createElement('nav');
    this.root.className = 'radial-menu';
    this.root.setAttribute('aria-label', 'cities');

    cities.forEach((city, i) => {
      const item = document.createElement('div');
      item.className = 'radial-item';
      item.setAttribute('role', 'button');
      item.style.setProperty('--c', city.colors.primary);

      // soft arc: names curve out from the left edge
      const a = (i - (cities.length - 1) / 2) * (ARC_SPREAD / (cities.length - 1));
      const x = Math.cos(a) * ARC_RADIUS - ARC_RADIUS;
      const y = Math.sin(a) * ARC_RADIUS;
      item.style.setProperty('--ax', `${x.toFixed(1)}px`);
      item.style.setProperty('--ay', `${y.toFixed(1)}px`);
      item.style.setProperty('--d', `${(i * 60).toFixed(0)}ms`);

      const name = document.createElement('div');
      name.className = 'radial-name';
      name.textContent = city.name;

      const coords = document.createElement('div');
      coords.className = 'radial-coords';
      coords.textContent = city.coordinates;

      item.appendChild(name);
      item.appendChild(coords);
      item.addEventListener('click', () => {
        if (this.onCitySelect) this.onCitySelect(i);
      });

      this.root.appendChild(item);
      this.items.push(item);
    });

    mount.appendChild(this.root);
  }

  setActiveCity(index) {
    this.activeIndex = index;
    this.items.forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  show() {
    if (this.root) this.root.classList.add('visible');
  }

  hide() {
    if (this.root) this.root.classList.remove('visible');
  }
}
