(function () {
  function createButton(className, label, text) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    button.textContent = text;
    return button;
  }

  function initCarousel(carousel) {
    var track = carousel.querySelector('.aha-carousel__track');
    var prev = carousel.querySelector('.aha-carousel__button--prev');
    var next = carousel.querySelector('.aha-carousel__button--next');
    var dotsWrap = carousel.querySelector('.aha-carousel__dots');
    if (!track || !prev || !next || !dotsWrap) return;

    var slides = Array.prototype.filter.call(track.children, function (child) {
      return child.nodeType === 1;
    });
    if (!slides.length) return;

    var cols = Math.max(1, parseInt(getComputedStyle(carousel).getPropertyValue('--carousel-cols'), 10) || 1);
    var pageCount = Math.max(1, slides.length - cols + 1);
    var activeIndex = 0;
    var timer = null;
    var duration = Math.max(0, parseInt(carousel.dataset.duration || '0', 10) || 0);
    var lightboxIndex = 0;
    var lastFocused = null;
    var lightboxZoom = 1;
    var lightboxBaseWidth = 0;
    var minZoom = 1;
    var maxZoom = 3;
    var zoomStep = 0.25;

    var lightboxItems = slides.map(function (slide) {
      var image = slide.querySelector('img');
      var caption = slide.querySelector('figcaption');
      return {
        image: image,
        src: image ? image.currentSrc || image.src : '',
        alt: image ? image.getAttribute('alt') || '' : '',
        caption: caption ? caption.textContent.trim() : '',
      };
    }).filter(function (item) {
      return Boolean(item.image && item.src);
    });

    var lightbox = document.createElement('div');
    lightbox.className = 'aha-carousel-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Image viewer');
    lightbox.hidden = true;
    lightbox.innerHTML = '<div class="aha-carousel-lightbox__content">' +
      '<img class="aha-carousel-lightbox__image" alt="" hidden>' +
      '<p class="aha-carousel-lightbox__caption"></p>' +
      '<p class="aha-carousel-lightbox__counter"></p>' +
      '</div>';

    var lightboxClose = createButton('aha-carousel-lightbox__close', 'Close image viewer', '\u00d7');
    var lightboxZoomOut = createButton('aha-carousel-lightbox__tool aha-carousel-lightbox__zoom-out', 'Zoom out', '\u2212');
    var lightboxZoomIn = createButton('aha-carousel-lightbox__tool aha-carousel-lightbox__zoom-in', 'Zoom in', '+');
    var lightboxPrev = createButton('aha-carousel-lightbox__button aha-carousel-lightbox__button--prev', 'Previous image', '\u2039');
    var lightboxNext = createButton('aha-carousel-lightbox__button aha-carousel-lightbox__button--next', 'Next image', '\u203a');
    var lightboxHint = createButton(
      'aha-carousel-lightbox__hint',
      'Hide keyboard shortcuts',
      'Keys: Left/Right navigate | + / - zoom | Esc close'
    );
    var lightboxTools = document.createElement('div');
    lightboxTools.className = 'aha-carousel-lightbox__tools';
    lightboxTools.appendChild(lightboxZoomOut);
    lightboxTools.appendChild(lightboxZoomIn);
    lightboxTools.appendChild(lightboxClose);
    lightbox.appendChild(lightboxHint);
    lightbox.appendChild(lightboxTools);
    lightbox.appendChild(lightboxPrev);
    lightbox.appendChild(lightboxNext);
    document.body.appendChild(lightbox);

    var lightboxImage = lightbox.querySelector('.aha-carousel-lightbox__image');
    var lightboxCaption = lightbox.querySelector('.aha-carousel-lightbox__caption');
    var lightboxCounter = lightbox.querySelector('.aha-carousel-lightbox__counter');

    dotsWrap.innerHTML = '';
    for (var i = 0; i < pageCount; i += 1) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'aha-carousel__dot';
      dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      dot.dataset.index = String(i);
      dotsWrap.appendChild(dot);
    }

    var dots = Array.prototype.slice.call(dotsWrap.children);

    function slideStep() {
      if (slides.length < 2) return 0;
      return slides[1].offsetLeft - slides[0].offsetLeft;
    }

    function updateControls() {
      dots.forEach(function (dot, index) {
        dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
      });
      prev.disabled = slides.length <= cols;
      next.disabled = slides.length <= cols;
      carousel.classList.toggle('aha-carousel--static', slides.length <= cols);
    }

    function applyLightboxZoom() {
      if (!lightboxBaseWidth) {
        lightboxImage.style.inlineSize = '';
        lightboxImage.classList.remove('aha-carousel-lightbox__image--zoomed');
      } else {
        lightboxImage.style.inlineSize = (lightboxBaseWidth * lightboxZoom) + 'px';
        lightboxImage.classList.toggle('aha-carousel-lightbox__image--zoomed', lightboxZoom > minZoom);
      }

      lightboxZoomOut.disabled = lightboxZoom <= minZoom;
      lightboxZoomIn.disabled = lightboxZoom >= maxZoom;
      lightbox.setAttribute('data-zoom', String(lightboxZoom));
    }

    function resetLightboxZoom() {
      lightboxZoom = minZoom;
      lightboxBaseWidth = 0;
      lightboxImage.style.inlineSize = '';
      lightboxImage.classList.remove('aha-carousel-lightbox__image--zoomed');
      applyLightboxZoom();
    }

    function setLightboxZoom(nextZoom) {
      if (!lightboxBaseWidth) {
        lightboxBaseWidth = lightboxImage.getBoundingClientRect().width;
        if (!lightboxBaseWidth) return;
      }

      lightboxZoom = Math.max(minZoom, Math.min(maxZoom, nextZoom));
      applyLightboxZoom();
    }

    function updateLightbox() {
      var item = lightboxItems[lightboxIndex];
      if (!item) return;
      var src = item.image.currentSrc || item.src;
      if (!src) return;

      resetLightboxZoom();
      lightboxImage.src = src;
      lightboxImage.alt = item.alt;
      lightboxImage.hidden = false;
      lightboxCaption.textContent = item.caption;
      lightboxCaption.hidden = !item.caption;
      lightboxCounter.textContent = (lightboxIndex + 1) + ' / ' + lightboxItems.length;
      lightboxPrev.hidden = lightboxItems.length <= 1;
      lightboxNext.hidden = lightboxItems.length <= 1;
    }

    function goToLightbox(index) {
      if (!lightboxItems.length) return;
      lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;
      updateLightbox();
    }

    function restartTimer() {
      if (!duration || slides.length <= cols) return;
      window.clearInterval(timer);
      timer = window.setInterval(function () {
        goTo(activeIndex + 1);
      }, duration);
    }

    function openLightbox(index) {
      if (!lightboxItems.length) return;
      lastFocused = document.activeElement;
      goToLightbox(index);
      lightbox.hidden = false;
      document.body.classList.add('aha-carousel-lightbox-open');
      lightboxClose.focus();
      window.clearInterval(timer);
    }

    function closeLightbox() {
      lightbox.hidden = true;
      document.body.classList.remove('aha-carousel-lightbox-open');
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
      restartTimer();
    }

    function goTo(index) {
      activeIndex = (index + pageCount) % pageCount;
      track.scrollTo({ left: slideStep() * activeIndex, behavior: 'smooth' });
      updateControls();
    }

    prev.addEventListener('click', function () {
      goTo(activeIndex - 1);
      restartTimer();
    });

    next.addEventListener('click', function () {
      goTo(activeIndex + 1);
      restartTimer();
    });

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        goTo(parseInt(dot.dataset.index, 10) || 0);
        restartTimer();
      });
    });

    lightboxItems.forEach(function (item, index) {
      item.image.classList.add('aha-carousel__image');
      item.image.setAttribute('role', 'button');
      item.image.setAttribute('tabindex', '0');
      item.image.setAttribute('aria-label', 'Open image ' + (index + 1) + ' in full screen');

      item.image.addEventListener('click', function () {
        openLightbox(index);
      });

      item.image.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(index);
        }
      });
    });

    lightboxPrev.addEventListener('click', function () {
      goToLightbox(lightboxIndex - 1);
    });

    lightboxNext.addEventListener('click', function () {
      goToLightbox(lightboxIndex + 1);
    });

    lightboxZoomOut.addEventListener('click', function () {
      setLightboxZoom(lightboxZoom - zoomStep);
    });

    lightboxZoomIn.addEventListener('click', function () {
      setLightboxZoom(lightboxZoom + zoomStep);
    });

    lightboxHint.addEventListener('click', function () {
      lightboxHint.hidden = true;
    });

    lightboxClose.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', function (event) {
      if (lightbox.hidden) return;

      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowLeft') {
        goToLightbox(lightboxIndex - 1);
      } else if (event.key === 'ArrowRight') {
        goToLightbox(lightboxIndex + 1);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setLightboxZoom(lightboxZoom + zoomStep);
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setLightboxZoom(lightboxZoom - zoomStep);
      }
    });

    track.addEventListener('scroll', function () {
      var step = slideStep();
      if (!step) return;
      activeIndex = Math.max(0, Math.min(pageCount - 1, Math.round(track.scrollLeft / step)));
      updateControls();
    }, { passive: true });

    carousel.addEventListener('mouseenter', function () {
      window.clearInterval(timer);
    });

    carousel.addEventListener('mouseleave', restartTimer);

    window.addEventListener('resize', function () {
      cols = Math.max(1, parseInt(getComputedStyle(carousel).getPropertyValue('--carousel-cols'), 10) || 1);
      pageCount = Math.max(1, slides.length - cols + 1);
      activeIndex = Math.min(activeIndex, pageCount - 1);
      updateControls();
      goTo(activeIndex);
    });

    updateControls();
    restartTimer();
  }

  function initAll() {
    document.querySelectorAll('.aha-carousel').forEach(initCarousel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
