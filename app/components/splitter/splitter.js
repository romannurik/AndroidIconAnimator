const DRAG_SLOP = 4;


class SplitterController {
  constructor($scope, $element, $attrs) {
    this.edge_ = $attrs.edge;
    this.min_ = Number($attrs.min) || 100;
    this.persistKey_ = $attrs.persistId ? `\$\$splitter::${$attrs.persistId}` : null;
    this.orientation_ = (this.edge_ == 'left' || this.edge_ == 'right')
        ? 'vertical'
        : 'horizontal';
    this.element_ = $element;
    this.parent_ = $element.parent();
    this.dragging_ = false;

    if (this.orientation_ == 'vertical') {
      this.sizeGetter_ = () => this.parent_.width();
      this.sizeSetter_ = size => this.parent_.width(size);
      this.clientXY_ = 'clientX';

    } else {
      this.sizeGetter_ = () => this.parent_.height();
      this.sizeSetter_ = size => this.parent_.height(size);
      this.clientXY_ = 'clientY';
    }

    this.addClasses_();
    this.setupEventListeners_();
    this.deserializeState_();
  }

  deserializeState_() {
    if (this.persistKey_ in localStorage) {
      this.setSize_(Number(localStorage[this.persistKey_]));
    }
  }

  addClasses_() {
    this.element_
        .addClass(`splt-${this.orientation_}`)
        .addClass(`splt-edge-${this.edge_}`);
  }

  setupEventListeners_() {
    let mouseMoveHandler_ = event => {
      if (!this.dragging_ && Math.abs(event[this.clientXY_] - this.downXY_) > DRAG_SLOP) {
        this.setDragging_(true);
      }

      if (this.dragging_) {
        let sign = (this.edge_ == 'left' || this.edge_ == 'top') ? -1 : 1;
        this.setSize_(Math.max(this.min_,
            this.downSize_ + sign * (event[this.clientXY_] - this.downXY_)));
      }
    };

    let mouseUpHandler_ = event => {
      $(window)
          .off('mousemove', mouseMoveHandler_)
          .off('mouseup', mouseUpHandler_);
      if (this.dragging_) {
        this.setDragging_(false);
        event.stopPropagation();
        event.preventDefault();
        return false;
      }
    };

    this.element_.on('mousedown', event => {
      this.downXY_ = event[this.clientXY_];
      this.downSize_ = this.sizeGetter_();
      $(window)
            .on('mousemove', mouseMoveHandler_)
            .on('mouseup', mouseUpHandler_);
    });
  }

  setSize_(size) {
    if (this.persistKey_) {
      localStorage[this.persistKey_] = size;
    }
    this.sizeSetter_(size);
  }

  setDragging_(dragging) {
    this.dragging_ = dragging;
    this.element_.toggleClass('is-dragging', dragging);
    $(document.body).toggleClass(`studio-splitter-dragging-${this.orientation_}`, dragging);
  }
}


angular.module('AVDStudio').directive('studioSplitter', () => {
  return {
    restrict: 'E',
    scope: {},
    template: '<div class="studio-splitter"></div>',
    replace: true,
    bindToController: true,
    controller: SplitterController,
    controllerAs: 'ctrl'
  };
});
